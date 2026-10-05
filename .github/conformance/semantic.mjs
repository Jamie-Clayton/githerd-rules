// Reference checker for the Lifecycle Policy Standard's semantic rules: the
// ones JSON Schema cannot express because they compare one part of the file
// with another. Run only on a document that is already schema-valid.
//
//   LP001  Every transition's `to`, and its `from` unless it is `*`, is one of
//          that policy's validStatuses.
//   LP002  Every triggeredBy token is in vocabulary.triggeredBy.active, or in
//          the core vocabulary's active list when the file declares none.
//   LP003  Every approverRoles token is in vocabulary.roles, when the file
//          declares roles.
//   LP004  Each policies key equals that policy's `type`.
//   LP005  No token is both active and retired.

export function checkSemantics(doc, coreVocabulary) {
  const findings = [];
  const add = (rule, path, message) => findings.push({ rule, path, message });

  const vocabulary = doc.vocabulary ?? {};
  const activeEvents = new Set(vocabulary.triggeredBy?.active ?? coreVocabulary.triggeredBy.active);
  const roles = vocabulary.roles ? new Set(vocabulary.roles) : null;

  for (const retired of vocabulary.triggeredBy?.retired ?? []) {
    if (activeEvents.has(retired.value)) {
      add('LP005', '/vocabulary/triggeredBy', `'${retired.value}' is both active and retired.`);
    }
  }

  for (const [key, policy] of Object.entries(doc.policies)) {
    const base = `/policies/${key}`;
    if (policy.type !== key) {
      add('LP004', `${base}/type`, `Policy key '${key}' does not equal its type '${policy.type}'.`);
    }
    const statuses = new Set(policy.validStatuses);
    policy.transitions.forEach((t, i) => {
      const at = `${base}/transitions/${i}`;
      if (t.from !== '*' && !statuses.has(t.from)) {
        add('LP001', `${at}/from`, `'${t.from}' is not in validStatuses.`);
      }
      if (!statuses.has(t.to)) {
        add('LP001', `${at}/to`, `'${t.to}' is not in validStatuses.`);
      }
      for (const event of t.triggeredBy) {
        if (!activeEvents.has(event)) {
          add('LP002', `${at}/triggeredBy`, `'${event}' is not an active triggeredBy token.`);
        }
      }
    });
    if (roles) {
      for (const role of policy.approverRoles ?? []) {
        if (!roles.has(role)) {
          add('LP003', `${base}/approverRoles`, `'${role}' is not in vocabulary.roles.`);
        }
      }
    }
  }
  return findings;
}
