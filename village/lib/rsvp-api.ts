import { API_URL } from '@/lib/config';

export type RsvpCategory = 'none' | 'few' | 'some' | 'many' | 'lots';

export type RsvpGuest = {
  rsvpid: number;
  userid: number;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture?: string | null;
};

export type RsvpInfoOwner = {
  isOwner: true;
  count: number;
  guests: RsvpGuest[];
};

export type RsvpInfoNonOwner = {
  isOwner: false;
  category: RsvpCategory;
};

export type RsvpInfo = RsvpInfoOwner | RsvpInfoNonOwner;

export async function toggleRsvp(postid: number, userid: number): Promise<{ rsvped: boolean; message: string }> {
  const response = await fetch(`${API_URL}/rsvps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postid, userid }),
  });
  if (!response.ok) throw new Error('Failed to toggle RSVP');
  return response.json();
}

export async function getRsvpInfo(postid: number, requesterid: number): Promise<RsvpInfo> {
  const response = await fetch(`${API_URL}/rsvps/post/${postid}?requesterid=${requesterid}`);
  if (!response.ok) throw new Error('Failed to fetch RSVP info');
  return response.json();
}

export async function checkRsvpStatus(postid: number, userid: number): Promise<boolean> {
  const response = await fetch(`${API_URL}/rsvps/check?postid=${postid}&userid=${userid}`);
  if (!response.ok) throw new Error('Failed to check RSVP status');
  const data = await response.json();
  return data.rsvped;
}

export async function getUserRsvps(userid: number) {
  const response = await fetch(`${API_URL}/rsvps/user/${userid}`);
  if (!response.ok) throw new Error('Failed to fetch user RSVPs');
  return response.json();
}

export function formatRsvpCategory(category: RsvpCategory): string {
  const map: Record<RsvpCategory, string> = {
    none: 'No one attending yet',
    few: 'A few people attending',
    some: 'Some people attending',
    many: 'Many people attending',
    lots: 'Lots of people attending',
  };
  return map[category];
}
