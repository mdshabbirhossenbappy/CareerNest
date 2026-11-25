const { canTransition, getAllowedNextStatuses } = require('../lib/stateMachine');
const { calculateSkillMatch } = require('../lib/skillMatcher');

describe('Application Workflow State Machine', () => {
  test('enforces strict sequential employer transitions without skipping states', () => {
    expect(canTransition('SUBMITTED', 'UNDER_REVIEW', 'EMPLOYER')).toBe(true);
    expect(canTransition('SUBMITTED', 'SELECTED', 'EMPLOYER')).toBe(false);
    expect(canTransition('SUBMITTED', 'REJECTED', 'EMPLOYER')).toBe(false);
    expect(canTransition('UNDER_REVIEW', 'SHORTLISTED', 'EMPLOYER')).toBe(true);
    expect(canTransition('UNDER_REVIEW', 'REJECTED', 'EMPLOYER')).toBe(true);
    expect(canTransition('SHORTLISTED', 'INTERVIEW_SCHEDULED', 'RECRUITER')).toBe(true);
    expect(canTransition('INTERVIEW_SCHEDULED', 'SELECTED', 'EMPLOYER')).toBe(true);
    expect(canTransition('INTERVIEW_SCHEDULED', 'REJECTED', 'EMPLOYER')).toBe(true);
  });

  test('allows student withdrawal before SELECTED and offer acceptance from SELECTED', () => {
    expect(canTransition('SUBMITTED', 'WITHDRAWN', 'STUDENT')).toBe(true);
    expect(canTransition('INTERVIEW_SCHEDULED', 'WITHDRAWN', 'STUDENT')).toBe(true);
    expect(canTransition('SELECTED', 'WITHDRAWN', 'STUDENT')).toBe(false);
    expect(canTransition('SELECTED', 'OFFER_ACCEPTED', 'STUDENT')).toBe(true);
    expect(getAllowedNextStatuses('OFFER_ACCEPTED', 'STUDENT')).toEqual([]);
  });
});

describe('Skill Matching Engine', () => {
  test('calculates accurate percentage match, matched, and missing skills', () => {
    const result = calculateSkillMatch(
      'JavaScript, Node.js, HTML, CSS',
      'javascript, node.js, sql, figma'
    );
    expect(result.score).toBe(50);
    expect(result.matchedSkills).toEqual(['javascript', 'node.js']);
    expect(result.missingSkills).toEqual(['sql', 'figma']);
  });

  test('handles empty student skills gracefully', () => {
    const result = calculateSkillMatch('', 'Python, SQL');
    expect(result.score).toBe(0);
    expect(result.missingSkills).toEqual(['python', 'sql']);
  });
});
