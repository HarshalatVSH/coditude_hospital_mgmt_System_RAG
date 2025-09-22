import { NextResponse } from "next/server";
import AccessToken, { VoiceGrant } from "twilio/lib/jwt/AccessToken";

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return NextResponse.json(
        {
          error: "Missing required Twilio configuration",
          missing: {
            accountSid: !accountSid,
            apiKey: !apiKey,
            apiSecret: !apiSecret,
            twimlAppSid: !twimlAppSid,
          },
        },
        { status: 500 }
      );
    }

    const identity = "user_" + Math.random().toString(36).substr(2, 9);
    const accessToken = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity,
      ttl: 3600,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });
    accessToken.addGrant(voiceGrant);

    return NextResponse.json({
      token: accessToken.toJwt(),
      identity: identity,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to generate access token",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
