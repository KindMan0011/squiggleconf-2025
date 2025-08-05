import { LightningTalk } from './types';

/**
 * Submit a lightning talk proposal for the Boston TS Club meetup.
 * Talks should be 3 minutes maximum.
 */
export async function submitLightningTalk(
  name: string,
  email: string,
  title: string,
  description: string
): Promise<boolean> {
  const talk: LightningTalk = {
    name,
    email,
    title,
    description,
    duration: 3, // minutes
    submitted: new Date(),
  };

  // During the conference, this would post to the API
  console.log('Lightning talk submitted:', talk);
  
  return true;
}
