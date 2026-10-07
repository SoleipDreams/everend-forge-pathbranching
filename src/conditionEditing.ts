import type { BranchingProject, LogicPredicate, LogicSubject } from './domain.js';
import { conditionValueMatchesType } from './conditionEvaluation.js';
import { logicFieldOptions, logicOperatorsFor, logicPredicateFor } from './logicCapabilities.js';

/** Preserve compatible operands; an incompatible new type requires an explicit value. */
export function retargetCondition(predicate: LogicPredicate, subject: LogicSubject, project: BranchingProject): LogicPredicate {
  const fields = logicFieldOptions(project, subject, 'condition');
  const previousKey = predicate.type === 'state' ? predicate.stateId : predicate.type === 'property' ? predicate.propertyId : predicate.type;
  const field = fields.find(f => f.key === previousKey) ?? fields[0];
  if (!field) return {...predicate, subject} as LogicPredicate;
  const next = logicPredicateFor(subject, field);
  const operator = logicOperatorsFor(field).includes(predicate.operator) ? predicate.operator : next.operator;
  const value = 'value' in predicate && conditionValueMatchesType(predicate.value, ['contains','notContains'].includes(operator) ? 'text' : field.valueType) ? predicate.value : undefined;
  return {...next, operator, ...('value' in next ? {value} : {})} as LogicPredicate;
}
