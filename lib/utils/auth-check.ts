import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'autonax-fallback-secret-degistir';
const TOKEN_COOKIE = 'autonax_token';

interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

/** Token doğrula — geçerliyse payload döner, değilse null */
function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expected) return null;
    const payload: TokenPayload = JSON.parse(
      Buffer.from(body, 'base64url').toString()
    );
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * API route'larda auth kontrolü.
 * Başarılıysa username döner, değilse 401 NextResponse döner.
 *
 * Kullanım:
 *   const auth = requireAuth(req);
 *   if (auth instanceof NextResponse) return auth; // 401
 *   // auth.username kullanılabilir
 */
export function requireAuth(req: NextRequest): { username: string } | NextResponse {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Oturum bulunamadı' },
      { status: 401 }
    );
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Oturum süresi dolmuş' },
      { status: 401 }
    );
  }
  return { username: payload.sub };
}
