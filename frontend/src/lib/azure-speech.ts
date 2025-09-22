import * as sdk from "microsoft-cognitiveservices-speech-sdk";

export class AzureSpeechService {
  private speechConfig: sdk.SpeechConfig;
  private audioConfig: sdk.AudioConfig;
  private synthesizer: sdk.SpeechSynthesizer;

  constructor() {
    const speechKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY!;
    const speechRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION!;

    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      speechKey,
      speechRegion
    );
    this.speechConfig.speechRecognitionLanguage = "en-US";
    this.speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";
    this.audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);
  }

  async startSpeechRecognition(): Promise<string> {
    return new Promise((resolve, reject) => {
      const recognizer = new sdk.SpeechRecognizer(
        this.speechConfig,
        this.audioConfig
      );

      recognizer.recognizeOnceAsync(
        (result) => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve(result.text);
          } else {
            reject(new Error("Speech recognition failed"));
          }
          recognizer.close();
        },
        (error) => {
          reject(error);
          recognizer.close();
        }
      );
    });
  }

  async textToSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve();
          } else {
            reject(new Error("Text-to-speech failed"));
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  dispose() {
    this.synthesizer.close();
  }
}
