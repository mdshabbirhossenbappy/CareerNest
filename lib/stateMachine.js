const EMPLOYER_TRANSITIONS = {
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW_SCHEDULED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['SELECTED', 'REJECTED'],
  SELECTED: [],
  REJECTED: [],
  OFFER_ACCEPTED: [],
  WITHDRAWN: [],
};

const STUDENT_TRANSITIONS = {
  SUBMITTED: ['WITHDRAWN'],
  UNDER_REVIEW: ['WITHDRAWN'],
  SHORTLISTED: ['WITHDRAWN'],
  INTERVIEW_SCHEDULED: ['WITHDRAWN'],
  SELECTED: ['OFFER_ACCEPTED'],
  REJECTED: [],
  OFFER_ACCEPTED: [],
  WITHDRAWN: [],
};

function canTransition(currentStatus, nextStatus, actorRole) {
  if (actorRole === 'STUDENT') {
    const allowed = STUDENT_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }
  if (actorRole === 'EMPLOYER' || actorRole === 'RECRUITER') {
    const allowed = EMPLOYER_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }
  return false;
}

function getAllowedNextStatuses(currentStatus, actorRole) {
  if (actorRole === 'STUDENT') {
    return STUDENT_TRANSITIONS[currentStatus] || [];
  }
  if (actorRole === 'EMPLOYER' || actorRole === 'RECRUITER') {
    return EMPLOYER_TRANSITIONS[currentStatus] || [];
  }
  return [];
}

module.exports = {
  EMPLOYER_TRANSITIONS,
  STUDENT_TRANSITIONS,
  canTransition,
  getAllowedNextStatuses,
};
