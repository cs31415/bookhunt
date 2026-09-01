/**
 * Whether registration needs an invite code (LOS-376).
 *
 * Defaults to invite. An unset or misspelt variable therefore closes
 * registration rather than opening it -- the failure that costs a would-be
 * reader an email is much cheaper than the one that reopens the door LOS-363
 * found sixty bots coming through.
 *
 * Read per call rather than captured at import, so a test can set the variable
 * without reloading the module.
 */
export function invitesRequired(): boolean {
  return process.env.REGISTRATION_MODE !== 'open';
}
