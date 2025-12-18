/**
 * Help text for the errors command
 * @packageDocumentation
 */

import pc from 'picocolors'

/**
 * Display help information for the errors command
 */
export function showErrorsHelp(): void {
  const help = `
${pc.bold('ix errors')} - Error code reference and troubleshooting

${pc.bold('USAGE')}
  ix errors [options] [code]
  ix help errors

${pc.bold('ARGUMENTS')}
  ${pc.cyan('code')}          Look up a specific error code (e.g., IX_E101)

${pc.bold('OPTIONS')}
  ${pc.cyan('--help, -h')}    Show this help message
  ${pc.cyan('--list')}        List all error codes
  ${pc.cyan('--category')}    Filter error codes by category
                  (config, build, deploy, database, auth, internal)
  ${pc.cyan('--no-color')}    Disable colored output

${pc.bold('EXAMPLES')}
  ${pc.dim('# Show help for errors command')}
  ix errors --help

  ${pc.dim('# Look up a specific error code')}
  ix errors IX_E101

  ${pc.dim('# List all error codes')}
  ix errors --list

  ${pc.dim('# List error codes for a specific category')}
  ix errors --list --category=config

${pc.bold('ERROR CODE FORMAT')}
  IX_E{category}{number}

  ${pc.bold('Categories:')}
    IX_E1XX - Configuration errors
    IX_E2XX - Build errors
    IX_E3XX - Deployment errors
    IX_E4XX - Database/migration errors
    IX_E5XX - Authentication errors
    IX_E9XX - Internal/unexpected errors

${pc.bold('REPORTING BUGS')}
  If you encounter an unexpected error or have questions:
  • Check the documentation: ${pc.cyan('https://ixflare.dev/docs/troubleshooting')}
  • Report issues: ${pc.cyan('https://github.com/ixflare/ixflare/issues')}

${pc.bold('VERBOSE DEBUGGING')}
  Add ${pc.cyan('--verbose')} or ${pc.cyan('-v')} to any command for detailed error information:
    • Full stack traces
    • Environment details
    • Internal error states
    • Configuration values

  Example: ${pc.dim('ix build --verbose')}
`

  console.log(help)
}
