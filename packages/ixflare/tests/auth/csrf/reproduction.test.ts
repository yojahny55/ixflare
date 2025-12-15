/**
 * CSRF Component Reproduction Test
 *
 * Verifies if CSRFInput functions as a valid React component.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { CSRFInput } from '../../../src/auth/csrf/client'

describe('CSRFInput Component Reproduction', () => {
    let originalDocument: typeof document | undefined

    beforeEach(() => {
        originalDocument = (global as any).document
            ; (global as any).document = {
                cookie: '__csrf=token-value.signature',
            }
    })

    afterEach(() => {
        if (originalDocument === undefined) {
            delete (global as any).document
        } else {
            ; (global as any).document = originalDocument
        }
    })

    it('should render as a valid React component', () => {
        // This should fail if CSRFInput returns a plain object instead of a React element
        try {
            // Use React.createElement to invoke the component
            const element = React.createElement(CSRFInput as any, {})
            const html = renderToStaticMarkup(element)

            console.log('Valid render output:', html)

            expect(html).toContain('type="hidden"')
            expect(html).toContain('value="token-value"')
        } catch (error: any) {
            console.error('Render failed:', error.message)
            throw error // Re-throw to fail the test
        }
    })
})
