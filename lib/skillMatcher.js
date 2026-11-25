function normalizeSkillList(raw) {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  const unique = new Set();
  raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .forEach((item) => unique.add(item));
  return Array.from(unique);
}

function calculateSkillMatch(studentSkillsStr, requiredSkillsStr) {
  const required = normalizeSkillList(requiredSkillsStr);
  if (required.length === 0) {
    return { score: 100, matchedSkills: [], missingSkills: [] };
  }
  const studentSet = new Set(normalizeSkillList(studentSkillsStr));
  const matchedSkills = [];
  const missingSkills = [];

  required.forEach((skill) => {
    if (studentSet.has(skill)) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  const score = Math.round((matchedSkills.length / required.length) * 100);
  return { score, matchedSkills, missingSkills };
}

module.exports = {
  normalizeSkillList,
  calculateSkillMatch,
};
