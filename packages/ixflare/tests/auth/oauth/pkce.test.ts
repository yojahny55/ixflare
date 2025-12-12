/**
 * @module tests/auth/oauth/pkce
 * @description Tests for PKCE implementation (RFC 7636 + RFC 9700)
 */

import { describe, it, expect } from 'vitest'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  validateCodeVerifier,
  verifyCodeChallenge,
} from '@/auth/oauth/pkce'

describe('PKCE (Proof Key for Code Exchange)', () => {
  describe('generateCodeVerifier', () => {
    it('should generate verifier with correct length (43-128 chars)', () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(verifier.length).toBeLessThanOrEqual(128)
    })

    it('should generate base64url-encoded string (no +, /, or =)', () => {
      const verifier = generateCodeVerifier()
      expect(verifier).not.toMatch(/[+/=]/)
    })

    it('should use only unreserved characters', () => {
      const verifier = generateCodeVerifier()
      // RFC 7636: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
    })

    it('should generate unique verifiers', () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()
      expect(verifier1).not.toBe(verifier2)
    })

    it('should provide sufficient entropy (256 bits)', () => {
      const verifiers = new Set()
      for (let i = 0; i < 1000; i++) {
        verifiers.add(generateCodeVerifier())
      }
      // All should be unique (collision probability negligible)
      expect(verifiers.size).toBe(1000)
    })
  })

  describe('generateCodeChallenge', () => {
    it('should generate S256 challenge from verifier', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      expect(challenge).toBeTruthy()
      expect(challenge.length).toBeGreaterThan(0)
    })

    it('should produce base64url-encoded string (no +, /, or =)', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      expect(challenge).not.toMatch(/[+/=]/)
    })

    it('should produce deterministic challenge for same verifier', async () => {
      const verifier = generateCodeVerifier()
      const challenge1 = await generateCodeChallenge(verifier)
      const challenge2 = await generateCodeChallenge(verifier)
      expect(challenge1).toBe(challenge2)
    })

    it('should produce different challenges for different verifiers', async () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()
      const challenge1 = await generateCodeChallenge(verifier1)
      const challenge2 = await generateCodeChallenge(verifier2)
      expect(challenge1).not.toBe(challenge2)
    })

    it('should use SHA-256 hashing (S256 method)', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      // SHA-256 produces 32 bytes = 43-44 base64url chars (after encoding and removing padding)
      expect(challenge.length).toBe(43)
    })
  })

  describe('validateCodeVerifier', () => {
    it('should accept valid verifiers', () => {
      const verifier = generateCodeVerifier()
      expect(validateCodeVerifier(verifier)).toBe(true)
    })

    it('should reject verifiers shorter than 43 chars', () => {
      const shortVerifier = 'abc123'
      expect(validateCodeVerifier(shortVerifier)).toBe(false)
    })

    it('should reject verifiers longer than 128 chars', () => {
      const longVerifier = 'a'.repeat(129)
      expect(validateCodeVerifier(longVerifier)).toBe(false)
    })

    it('should reject verifiers with invalid characters', () => {
      const invalidVerifier = 'abc!@#$%^&*()+=[]{}|;:,<>?/\\'.padEnd(43, 'a')
      expect(validateCodeVerifier(invalidVerifier)).toBe(false)
    })

    it('should accept unreserved characters (RFC 7636)', () => {
      const validVerifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
      expect(validateCodeVerifier(validVerifier)).toBe(true)
    })
  })

  describe('verifyCodeChallenge', () => {
    it('should verify valid challenge against verifier', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      const isValid = await verifyCodeChallenge(verifier, challenge)
      expect(isValid).toBe(true)
    })

    it('should reject invalid challenge', async () => {
      const verifier = generateCodeVerifier()
      const wrongChallenge = 'invalid-challenge'
      const isValid = await verifyCodeChallenge(verifier, wrongChallenge)
      expect(isValid).toBe(false)
    })

    it('should reject challenge for different verifier', async () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()
      const challenge1 = await generateCodeChallenge(verifier1)
      const isValid = await verifyCodeChallenge(verifier2, challenge1)
      expect(isValid).toBe(false)
    })

    it('should reject invalid verifier format', async () => {
      const invalidVerifier = 'short'
      const challenge = 'some-challenge'
      const isValid = await verifyCodeChallenge(invalidVerifier, challenge)
      expect(isValid).toBe(false)
    })
  })

  describe('Security: RFC 9700 Compliance', () => {
    it('should ONLY support S256 method (plain method NOT implemented)', async () => {
      // This test verifies that we do NOT implement the insecure "plain" method
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)

      // Challenge should NOT equal verifier (that would be plain method)
      expect(challenge).not.toBe(verifier)

      // Challenge should be SHA-256 hash (43 chars for 256-bit hash)
      expect(challenge.length).toBe(43)
    })

    it('should prevent code interception attacks', async () => {
      // Even if an attacker intercepts the authorization code,
      // they cannot exchange it without the code_verifier

      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)

      // Attacker cannot derive verifier from challenge (one-way hash)
      // They would need to brute-force 2^256 possibilities
      expect(challenge).not.toBe(verifier)

      // Only possession of original verifier allows token exchange
      const isValid = await verifyCodeChallenge(verifier, challenge)
      expect(isValid).toBe(true)

      // Different verifier fails verification
      const attackerVerifier = generateCodeVerifier()
      const attackerValid = await verifyCodeChallenge(attackerVerifier, challenge)
      expect(attackerValid).toBe(false)
    })
  })

  describe('Integration: PKCE Flow Simulation', () => {
    it('should simulate complete PKCE flow', async () => {
      // Step 1: Client generates code_verifier
      const codeVerifier = generateCodeVerifier()
      expect(validateCodeVerifier(codeVerifier)).toBe(true)

      // Step 2: Client generates code_challenge from verifier
      const codeChallenge = await generateCodeChallenge(codeVerifier)

      // Step 3: Client sends code_challenge to authorization server
      // (simulated - authorization server would store this)

      // Step 4: After user authorizes, client receives authorization code
      // (simulated)

      // Step 5: Client exchanges code + code_verifier for tokens
      // Authorization server verifies code_challenge matches verifier
      const isValid = await verifyCodeChallenge(codeVerifier, codeChallenge)
      expect(isValid).toBe(true)

      // Only with correct verifier can token be obtained
    })

    it('should prevent authorization code injection', async () => {
      // Legitimate client flow
      const legitimateVerifier = generateCodeVerifier()
      const legitimateChallenge = await generateCodeChallenge(legitimateVerifier)

      // Attacker intercepts authorization code but doesn't have verifier
      const attackerVerifier = generateCodeVerifier()

      // Attacker cannot exchange code - verification fails
      const attackerValid = await verifyCodeChallenge(attackerVerifier, legitimateChallenge)
      expect(attackerValid).toBe(false)

      // Only legitimate client with original verifier succeeds
      const legitimateValid = await verifyCodeChallenge(legitimateVerifier, legitimateChallenge)
      expect(legitimateValid).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle minimum length verifier (43 chars)', async () => {
      const verifier = generateCodeVerifier()
      // Generated verifier should be at least 43 chars
      expect(verifier.length).toBeGreaterThanOrEqual(43)

      const challenge = await generateCodeChallenge(verifier)
      const isValid = await verifyCodeChallenge(verifier, challenge)
      expect(isValid).toBe(true)
    })

    it('should handle special unreserved characters', async () => {
      // Use all allowed unreserved characters
      const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~'
      expect(validateCodeVerifier(verifier)).toBe(true)

      const challenge = await generateCodeChallenge(verifier)
      const isValid = await verifyCodeChallenge(verifier, challenge)
      expect(isValid).toBe(true)
    })
  })
})
