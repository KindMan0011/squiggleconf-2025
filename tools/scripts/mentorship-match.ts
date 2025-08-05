interface MentorshipParticipant {
  name: string;
  email: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  isOpenToRemote: boolean;
  location?: string;
  preferredMeetingTimes?: string[];
}

interface MentorshipMatch {
  mentor: MentorshipParticipant;
  mentee: MentorshipParticipant;
  commonInterests: string[];
  suggestedStartingProjects: string[];
}

/**
 * Simple algorithm to match mentors with mentees based on 
 * common interests and experience levels.
 */
function matchMentorshipParticipants(
  mentors: MentorshipParticipant[],
  mentees: MentorshipParticipant[]
): MentorshipMatch[] {
  const matches: MentorshipMatch[] = [];
  
  // Implementation would go here
  
  return matches;
}

// Export for use in the Michigan TypeScript mentorship program
export { 
  MentorshipParticipant,
  MentorshipMatch,
  matchMentorshipParticipants
};
