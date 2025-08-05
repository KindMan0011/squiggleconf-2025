// Type definitions for conference tools and scripts

export interface LightningTalk {
  name: string;
  email: string;
  title: string;
  description: string;
  duration: number; // in minutes
  submitted: Date;
}

export interface MentorshipParticipant {
  name: string;
  email: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  isOpenToRemote: boolean;
  location?: string;
  preferredMeetingTimes?: string[];
}

export interface MentorshipMatch {
  mentor: MentorshipParticipant;
  mentee: MentorshipParticipant;
  commonInterests: string[];
  suggestedStartingProjects: string[];
}