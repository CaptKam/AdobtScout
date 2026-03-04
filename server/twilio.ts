import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken) {
  console.warn('⚠️ Twilio credentials not configured. SMS and video features will be disabled.');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

// Create a Twilio video room for virtual tours
export async function createVideoRoom(roomName: string): Promise<{ roomSid: string; roomName: string }> {
  if (!client) {
    throw new Error('Twilio not configured. Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to secrets.');
  }

  try {
    const room = await client.video.v1.rooms.create({
      uniqueName: roomName,
      type: 'group',
      maxParticipants: 4,
      recordParticipantsOnConnect: false,
    });

    console.log(`✓ Created Twilio video room: ${room.uniqueName} (${room.sid})`);
    return {
      roomSid: room.sid,
      roomName: room.uniqueName,
    };
  } catch (error) {
    console.error('Error creating Twilio video room:', error);
    throw error;
  }
}

// Generate access token for a video room participant
export function generateVideoToken(roomName: string, participantName: string): string {
  if (!accountSid || !authToken) {
    throw new Error('Twilio not configured.');
  }

  const { AccessToken } = twilio.jwt;
  const { VideoGrant } = AccessToken;

  const token = new AccessToken(accountSid, process.env.TWILIO_API_KEY_SID!, process.env.TWILIO_API_KEY_SECRET!, {
    identity: participantName,
  });

  const videoGrant = new VideoGrant({
    room: roomName,
  });

  token.addGrant(videoGrant);
  return token.toJwt();
}

// Send SMS notification for virtual tour scheduling
export async function sendVirtualTourSMS(
  toPhoneNumber: string,
  dogName: string,
  scheduledAt: Date,
  videoRoomUrl: string
): Promise<void> {
  if (!client || !twilioPhoneNumber) {
    console.log('Twilio SMS not configured, skipping notification');
    return;
  }

  try {
    const message = await client.messages.create({
      body: `🐾 Your virtual meet & greet with ${dogName} is confirmed!\n\n📅 ${scheduledAt.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}\n\n🎥 Join here: ${videoRoomUrl}\n\nSee you soon! - Scout`,
      from: twilioPhoneNumber,
      to: toPhoneNumber,
    });

    console.log(`✓ Sent virtual tour SMS to ${toPhoneNumber}: ${message.sid}`);
  } catch (error) {
    console.error('Error sending SMS:', error);
    // Don't throw - SMS is a nice-to-have, not critical
  }
}

// Send SMS reminder 1 hour before virtual tour
export async function sendVirtualTourReminder(
  toPhoneNumber: string,
  dogName: string,
  videoRoomUrl: string
): Promise<void> {
  if (!client || !twilioPhoneNumber) {
    return;
  }

  try {
    const message = await client.messages.create({
      body: `🔔 Reminder: Your virtual meet & greet with ${dogName} starts in 1 hour!\n\n🎥 Join here: ${videoRoomUrl}\n\nWe can't wait to introduce you! - Scout`,
      from: twilioPhoneNumber,
      to: toPhoneNumber,
    });

    console.log(`✓ Sent reminder SMS: ${message.sid}`);
  } catch (error) {
    console.error('Error sending reminder SMS:', error);
  }
}