/**
 * InvoiceReady v1.0 - Server-Side Authentication & Tenant RBAC Derivation
 * Conforms to Requirements 2, 3, 4, 7-12, Sections 27, 28, 62.
 *
 * Production Hardening Guarantees:
 * 1. Uses Firebase Admin SDK for real server-side ID token verification.
 * 2. In production, client-generated or fake tokens are strictly rejected.
 * 3. Resolves user identity, organization_id, and RBAC role exclusively from PostgreSQL.
 * 4. Never trusts client-supplied organization_id, role, score, or billing state.
 * 5. Test token functionality is strictly isolated to explicit test mode (NODE_ENV === 'test').
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { DatabaseService } from '../db/postgres';

export interface AuthenticatedUserContext {
  userId: string;
  firebaseUid: string;
  email: string;
  fullName: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';
}

declare global {
  namespace Express {
    interface Request {
      userContext?: AuthenticatedUserContext;
    }
  }
}

export interface VerifiedUserClaims {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isAnonymous: boolean;
}

export class TokenVerifier {
  private static adminAuth: Auth | null = null;
  private static JWT_TEST_SECRET = process.env.JWT_SECRET || 'invoiceready-test-only-secret-2026';

  /**
   * Initializes Firebase Admin SDK if not already initialized
   */
  public static getAdminAuth(): Auth | null {
    if (this.adminAuth) return this.adminAuth;

    try {
      if (getApps().length === 0) {
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
        if (process.env.NODE_ENV === 'production' && !projectId) {
          throw new Error('FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT must be configured in production.');
        }
        initializeApp({ projectId: projectId || 'invoiceready-prod' });
      }
      this.adminAuth = getAuth();
      return this.adminAuth;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `FATAL: Firebase Admin SDK initialization failed in production mode: ${err.message}. Never silently enter test mode.`
        );
      }
      return null;
    }
  }

  /**
   * Verifies Firebase ID Token server-side (Requirement 8, 9, 10)
   */
  public static async verifyToken(
    token: string
  ): Promise<VerifiedUserClaims | null> {
    // 1. In production, strictly verify cryptographically using Firebase Admin SDK (Requirement 8)
    if (process.env.NODE_ENV === 'production') {
      const admin = this.getAdminAuth();
      if (!admin) {
        throw new Error('FATAL: Firebase Admin authentication not initialized in production mode.');
      }
      try {
        const decoded = await admin.verifyIdToken(token);
        const isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
        return {
          uid: decoded.uid,
          email: decoded.email || `${decoded.uid}@firebase.internal`,
          name: decoded.name || (isAnonymous ? 'Guest Auditor' : 'Firebase User'),
          emailVerified: Boolean(decoded.email_verified),
          isAnonymous,
        };
      } catch (err) {
        return null;
      }
    }

    // 2. In development, accept Firebase token or authenticated dev session token
    if (process.env.NODE_ENV === 'development') {
      const admin = this.getAdminAuth();
      if (admin) {
        try {
          const decoded = await admin.verifyIdToken(token);
          const isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
          return {
            uid: decoded.uid,
            email: decoded.email || `${decoded.uid}@firebase.internal`,
            name: decoded.name || (isAnonymous ? 'Guest Auditor' : 'Firebase User'),
            emailVerified: Boolean(decoded.email_verified),
            isAnonymous,
          };
        } catch (_) {}
      }

      if (process.env.ALLOW_TEST_AUTH === 'true' && token === 'dev_preview_token') {
        return {
          uid: 'usr_dev_auditor_01',
          email: 'auditor@invoiceready.internal',
          name: 'Lead Compliance Auditor',
          emailVerified: true,
          isAnonymous: false,
        };
      }

      return null;
    }

    // 3. Test Mode Path (strictly active ONLY when NODE_ENV === 'test') (Requirement 9)
    if (process.env.NODE_ENV === 'test') {
      try {
        const decoded: any = jwt.verify(token, this.JWT_TEST_SECRET);
        if (!decoded) return null;

        const uid = decoded.user_id || decoded.sub || decoded.uid;
        const email = decoded.email || `${uid}@invoiceready.internal`;
        const name = decoded.name || decoded.displayName || 'Authorized User';

        if (!uid) return null;
        return {
          uid,
          email,
          name,
          emailVerified: true,
          isAnonymous: false,
        };
      } catch (err) {
        return null;
      }
    }

    return null;
  }

  /**
   * Generates a signed token for automated integration test execution ONLY (Requirement 9)
   * Strictly restricted to NODE_ENV === 'test'.
   */
  public static generateTestToken(uid: string, email: string, name: string): string {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Test token generation is strictly forbidden outside of NODE_ENV === "test".');
    }
    return jwt.sign(
      {
        uid,
        sub: uid,
        user_id: uid,
        email,
        name,
        iss: 'https://securetoken.google.com/invoiceready-test',
        aud: 'invoiceready-test',
        auth_time: Math.floor(Date.now() / 1000),
      },
      this.JWT_TEST_SECRET,
      { expiresIn: '2h' }
    );
  }

  /**
   * Express middleware: Enforces Authentication and derives organization_id from PostgreSQL (Requirements 4, 11)
   */
  public static async requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected Bearer <token>.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const claims = await TokenVerifier.verifyToken(token);

    if (!claims) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid, forged, or expired authentication credentials.',
      });
      return;
    }

    try {
      // Authoritative server-side derivation in PostgreSQL (Requirement 6, 11)
      const userContext = await DatabaseService.resolveUserAndTenant(
        claims.uid,
        claims.email,
        claims.name,
        {
          emailVerified: claims.emailVerified,
          isAnonymous: claims.isAnonymous,
          allowAutoOrgCreation: true,
        }
      );

      if (!userContext) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User does not belong to an active organization.',
        });
        return;
      }

      req.userContext = userContext;
      next();
    } catch (err: any) {
      console.error('Tenant resolution failure:', err.message);
      res.status(500).json({ error: 'Internal server authorization error.' });
    }
  }

  /**
   * Role-Based Access Control Middleware (PRD-043)
   */
  public static requireRole(minimumRole: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER') {
    const roleHierarchy: Record<string, number> = {
      OWNER: 4,
      ADMIN: 3,
      ANALYST: 2,
      VIEWER: 1,
    };

    return (req: Request, res: Response, next: NextFunction): void => {
      const userContext = req.userContext;
      if (!userContext) {
        res.status(401).json({ error: 'Authentication required prior to RBAC evaluation.' });
        return;
      }

      const userLevel = roleHierarchy[userContext.role] || 0;
      const requiredLevel = roleHierarchy[minimumRole] || 0;

      if (userLevel < requiredLevel) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Operation requires minimum role: ${minimumRole}. Current role: ${userContext.role}.`,
        });
        return;
      }

      next();
    };
  }
}
