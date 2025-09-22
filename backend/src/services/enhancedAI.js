import { aiResponse } from "../utils/ai.js";
import { RAGService } from "./ragService.js";
import { AppointmentService } from "./appointmentService.js";
import { format, addDays, parseISO } from "date-fns";
import twilio from "twilio";

// Initialize Twilio client for SMS
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export class EnhancedAIService {
  constructor() {
    this.ragService = new RAGService();
    this.appointmentService = new AppointmentService();
    this.conversationSessions = new Map();
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log("🚀 Initializing Enhanced AI Service...");

      // Initialize RAG service
      await this.ragService.initialize();

      this.initialized = true;
      console.log("✅ Enhanced AI Service initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing Enhanced AI Service:", error);
      this.initialized = false;
    }
  }

  async processUserInput(callSid, userInput, conversationHistory = []) {
    try {
      // Get or create conversation session
      let session =
        this.conversationSessions.get(callSid) || this.createSession(callSid);

      // Debug logging
      console.log(
        `🔍 Processing: "${userInput}" | Step: ${session.step} | Intent: ${session.intent}`
      );

      // Detect intent and extract entities
      const analysis = await this.analyzeUserInput(userInput, session);

      // Debug extracted data
      console.log(`🔍 Extracted data:`, analysis.extractedData);

      // Update session with analysis
      session = this.updateSession(callSid, analysis);

      // Generate contextual response based on intent
      const response = await this.generateResponse(
        callSid,
        userInput,
        analysis,
        conversationHistory
      );

      // Log conversation
      await this.logConversation(callSid, userInput, response, analysis);

      return response;
    } catch (error) {
      console.error("❌ Error processing user input:", error);
      return this.getFallbackResponse();
    }
  }

  createSession(callSid) {
    const session = {
      callSid,
      startTime: new Date(),
      lastActivity: new Date(),
      intent: null,
      step: "greeting",
      extractedData: {},
      appointmentData: {},
      conversationCount: 0,
    };

    this.conversationSessions.set(callSid, session);
    return session;
  }

  updateSession(callSid, analysis) {
    const session = this.conversationSessions.get(callSid);
    if (!session) return this.createSession(callSid);

    // Update session with new data
    session.lastActivity = new Date();
    session.conversationCount++;

    if (analysis.intent && !session.intent) {
      session.intent = analysis.intent;
    }

    if (analysis.extractedData) {
      Object.assign(session.extractedData, analysis.extractedData);
      console.log(`🔍 Updated session data:`, session.extractedData);
    }

    // Determine next step
    session.step = this.determineNextStep(session, analysis);
    console.log(`🔍 Next step: ${session.step}`);

    this.conversationSessions.set(callSid, session);
    return session;
  }

  async analyzeUserInput(userInput, session) {
    const analysis = {
      intent: null,
      extractedData: {},
      confidence: 0,
    };

    // Simple intent detection
    analysis.intent = this.detectIntent(userInput, session);

    // Extract relevant information based on intent
    analysis.extractedData = this.extractInformation(
      userInput,
      analysis.intent,
      session.step
    );

    return analysis;
  }

  detectIntent(userInput, session) {
    const input = userInput.toLowerCase();

    // If we already have an intent, stick with it unless user explicitly changes
    if (session.intent && !this.hasIntentChange(input)) {
      return session.intent;
    }

    const intentPatterns = {
      schedule_appointment: [
        "schedule",
        "book",
        "make appointment",
        "need to see",
        "want to see",
        "appointment",
        "visit",
        "checkup",
        "check up",
        "physical",
        "need an appointment",
      ],
      reschedule_appointment: [
        "reschedule",
        "change appointment",
        "move appointment",
        "different time",
        "different day",
      ],
      cancel_appointment: [
        "cancel",
        "delete appointment",
        "remove appointment",
        "no longer need",
      ],
      check_appointment: [
        "check appointment",
        "confirm appointment",
        "verify",
        "when is my appointment",
      ],
      provider_info: [
        "who is",
        "tell me about",
        "doctor",
        "provider",
        "specialist",
      ],
      policy_question: [
        "policy",
        "what is your",
        "how much",
        "cost",
        "insurance",
        "billing",
      ],
    };

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some((pattern) => input.includes(pattern))) {
        return intent;
      }
    }

    return session.intent || "general_inquiry";
  }

  hasIntentChange(input) {
    const changePatterns = [
      "actually",
      "instead",
      "change of mind",
      "different",
      "no wait",
    ];
    return changePatterns.some((pattern) => input.includes(pattern));
  }

  extractInformation(userInput, intent, step) {
    const extracted = {};
    const input = userInput.toLowerCase();

    // Extract confirmation responses (YES/NO)
    const confirmationPatterns = [
      // Positive confirmations
      /\b(yes|yeah|yep|correct|right|book|confirm|schedule|ok|okay)\b/i,
      // Negative confirmations
      /\b(no|nope|incorrect|wrong|cancel|different)\b/i,
    ];

    if (step === "confirm_appointment") {
      if (confirmationPatterns[0].test(input)) {
        extracted.confirmation = "yes";
        console.log(`✅ Extracted confirmation: YES`);
      } else if (confirmationPatterns[1].test(input)) {
        extracted.confirmation = "no";
        console.log(`❌ Extracted confirmation: NO`);
      }
    }

    // Enhanced phone number extraction for voice input
    // Handle various voice-to-text formats
    const phonePatterns = [
      // Standard format: (555) 123-4567 or 555-123-4567
      /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/,
      // Spaced format: 8 6 9 8 2 0 2 0 7 9
      /(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)/,
      // Partially spaced: 869 820 2079
      /(\d{3})\s+(\d{3})\s+(\d{4})/,
      // Plus format: +91 8698202079
      /\+\s*(\d+)\s*(\d{10})/,
      // Long continuous: 8698202079
      /(\d{10})/,
    ];

    for (const pattern of phonePatterns) {
      const phoneMatch = userInput.match(pattern);
      if (phoneMatch) {
        // Clean up the phone number
        let phone = phoneMatch[0].replace(/\D/g, "");
        // If it has country code, remove it
        if (phone.length > 10) {
          phone = phone.slice(-10);
        }
        if (phone.length === 10) {
          extracted.phone = phone;
          console.log(`📱 Extracted phone: ${phone}`);
          break;
        }
      }
    }

    // Enhanced name extraction for voice input
    const namePatterns = [
      // "My name is John Smith"
      /(?:my name is|i'm|i am|name is)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i,
      // "I'm John Smith"
      /i'?m\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i,
      // "This is John Smith"
      /this is\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i,
      // "John Smith" at the beginning
      /^([a-zA-Z]+\s+[a-zA-Z]+)/,
      // Just a first name
      /(?:first name|name)\s+is\s+([a-zA-Z]+)/i,
    ];

    for (const pattern of namePatterns) {
      const nameMatch = userInput.match(pattern);
      if (nameMatch && nameMatch[1]) {
        const names = nameMatch[1].trim().split(/\s+/);
        if (names.length >= 1) {
          extracted.firstName = names[0];
          console.log(`👤 Extracted first name: ${names[0]}`);
        }
        if (names.length >= 2) {
          extracted.lastName = names.slice(1).join(" ");
          console.log(`👤 Extracted last name: ${extracted.lastName}`);
        }
        break;
      }
    }

    // Separate last name extraction
    const lastNamePatterns = [
      /(?:last name|surname)\s+is\s+([a-zA-Z]+)/i,
      /my last name is\s+([a-zA-Z]+)/i,
    ];

    for (const pattern of lastNamePatterns) {
      const lastNameMatch = userInput.match(pattern);
      if (lastNameMatch) {
        extracted.lastName = lastNameMatch[1];
        console.log(`👤 Extracted last name: ${lastNameMatch[1]}`);
        break;
      }
    }

    // Enhanced appointment type extraction
    const appointmentTypes = {
      checkup: "WELLNESS_CHECK",
      "check up": "WELLNESS_CHECK",
      "check-up": "WELLNESS_CHECK",
      physical: "WELLNESS_CHECK",
      routine: "FOLLOW_UP",
      "follow up": "FOLLOW_UP",
      followup: "FOLLOW_UP",
      "follow-up": "FOLLOW_UP",
      urgent: "URGENT_CARE",
      emergency: "URGENT_CARE",
      "new patient": "NEW_PATIENT",
      "first time": "NEW_PATIENT",
      consultation: "CONSULTATION",
    };

    for (const [keyword, type] of Object.entries(appointmentTypes)) {
      if (input.includes(keyword)) {
        extracted.appointmentType = type;
        console.log(`📅 Extracted appointment type: ${type}`);
        break;
      }
    }

    // Enhanced specialty extraction
    const specialtyMappings = {
      "primary care": "Primary Care",
      "family medicine": "Primary Care",
      "family doctor": "Primary Care",
      general: "Primary Care",
      cardiology: "Cardiology",
      heart: "Cardiology",
      cardiac: "Cardiology",
      "chest pain": "Cardiology",
      dermatology: "Dermatology",
      skin: "Dermatology",
      dermatologist: "Dermatology",
      orthopedics: "Orthopedics",
      orthopedic: "Orthopedics",
      bone: "Orthopedics",
      joint: "Orthopedics",
      "sports injury": "Orthopedics",
      pediatrics: "Pediatrics",
      pediatric: "Pediatrics",
      children: "Pediatrics",
      kids: "Pediatrics",
      child: "Pediatrics",
    };

    for (const [keyword, specialty] of Object.entries(specialtyMappings)) {
      if (input.includes(keyword)) {
        extracted.specialty = specialty;
        console.log(`🏥 Extracted specialty: ${specialty}`);
        break;
      }
    }

    // Enhanced time preferences extraction
    const timePatterns = [
      // Standard time format: 2:30 PM
      /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i,
      // Spoken time: "two thirty PM", "nine AM"
      /(?:at\s+)?(nine|ten|eleven|twelve|one|two|three|four|five|six|seven|eight)\s*(am|pm|o'?clock)/i,
      // "in the morning/afternoon/evening"
      /(morning|afternoon|evening)/i,
    ];

    for (const pattern of timePatterns) {
      const timeMatch = userInput.match(pattern);
      if (timeMatch) {
        if (timeMatch[1] && timeMatch[3]) {
          // Standard format
          const hour = timeMatch[1];
          const minute = timeMatch[2] || "00";
          const period = timeMatch[3].toLowerCase().replace(/\./g, "");
          extracted.preferredTime = `${hour}:${minute} ${period}`;
        } else if (timeMatch[1] && timeMatch[2]) {
          // Spoken format
          const spokenNumbers = {
            nine: "9",
            ten: "10",
            eleven: "11",
            twelve: "12",
            one: "1",
            two: "2",
            three: "3",
            four: "4",
            five: "5",
            six: "6",
            seven: "7",
            eight: "8",
          };
          const hour =
            spokenNumbers[timeMatch[1].toLowerCase()] || timeMatch[1];
          const period = timeMatch[2].toLowerCase().replace(/['\.]/g, "");
          extracted.preferredTime = `${hour}:00 ${period}`;
        }
        console.log(`⏰ Extracted time: ${extracted.preferredTime}`);
        break;
      }
    }

    // Enhanced day preferences extraction
    const dayPatterns = [
      // Specific days
      /(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      // Relative days
      /(tomorrow|today|next week|this week)/i,
      // "As soon as possible"
      /(asap|as soon as possible|immediately|urgent)/i,
    ];

    for (const pattern of dayPatterns) {
      const dayMatch = userInput.match(pattern);
      if (dayMatch) {
        extracted.preferredDay = dayMatch[1].toLowerCase();
        console.log(`📅 Extracted day: ${extracted.preferredDay}`);
        break;
      }
    }

    // Enhanced appointment selection extraction
    const selectionPatterns = [
      // "option 1", "number 1", "choice 1"
      /(?:option|number|choice)\s*(one|two|three|four|five|1|2|3|4|5)/i,
      // "the first one", "first option"
      /(first|second|third|fourth|fifth)\s*(?:one|option|appointment)?/i,
      // "I'll take the first", "book the second"
      /(?:take|book|want)\s*(?:the\s*)?(first|second|third|1|2|3)/i,
      // Just numbers
      /^(1|2|3|4|5|one|two|three|four|five)$/i,
    ];

    for (const pattern of selectionPatterns) {
      const selectionMatch = userInput.match(pattern);
      if (selectionMatch) {
        const selection = selectionMatch[1].toLowerCase();
        const numberMap = {
          one: 0,
          first: 0,
          1: 0,
          two: 1,
          second: 1,
          2: 1,
          three: 2,
          third: 2,
          3: 2,
          four: 3,
          fourth: 3,
          4: 3,
          five: 4,
          fifth: 4,
          5: 4,
        };

        if (numberMap.hasOwnProperty(selection)) {
          extracted.selectedSlotIndex = numberMap[selection];
          console.log(
            `🎯 Extracted slot selection: ${extracted.selectedSlotIndex}`
          );
        }
        break;
      }
    }

    // Email extraction (bonus)
    const emailMatch = userInput.match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    );
    if (emailMatch) {
      extracted.email = emailMatch[1];
      console.log(`📧 Extracted email: ${emailMatch[1]}`);
    }

    return extracted;
  }

  determineNextStep(session, analysis) {
    const { intent, extractedData } = analysis;
    const currentData = session.extractedData;

    console.log(
      `🔍 Determining next step - Intent: ${intent}, Current data:`,
      currentData
    );

    switch (intent) {
      case "schedule_appointment":
        // Handle confirmation step
        if (session.step === "confirm_appointment") {
          if (extractedData.confirmation === "yes") {
            return "book_appointment";
          } else if (extractedData.confirmation === "no") {
            return "show_available_slots"; // Go back to slot selection
          }
          return "confirm_appointment"; // Stay and ask again
        }

        if (!currentData.appointmentType) {
          return "collect_appointment_type";
        }
        if (!currentData.specialty && !currentData.provider) {
          return "collect_specialty";
        }
        if (!currentData.firstName || !currentData.phone) {
          return "collect_patient_info";
        }
        if (
          !currentData.preferredTime &&
          !currentData.preferredDay &&
          currentData.selectedSlotIndex === undefined
        ) {
          return "collect_time_preference";
        }
        if (
          currentData.selectedSlotIndex !== undefined &&
          session.step !== "confirm_appointment"
        ) {
          return "confirm_appointment";
        }
        return "show_available_slots";

      case "reschedule_appointment":
      case "cancel_appointment":
      case "check_appointment":
        if (!currentData.phone) {
          return "collect_patient_phone";
        }
        return "find_appointments";

      default:
        return "handle_inquiry";
    }
  }

  async generateResponse(callSid, userInput, analysis, conversationHistory) {
    const session = this.conversationSessions.get(callSid);

    console.log(`🎭 Generating response for step: ${session.step}`);

    switch (session.step) {
      case "greeting":
        return this.generateGreeting();

      case "collect_appointment_type":
        return this.generateAppointmentTypeRequest();

      case "collect_specialty":
        return this.generateSpecialtyRequest();

      case "collect_patient_info":
        return this.generatePatientInfoRequest(session.extractedData);

      case "collect_time_preference":
        return this.generateTimePreferenceRequest();

      case "show_available_slots":
        return await this.generateAvailableSlots(session);

      case "confirm_appointment":
        return await this.generateAppointmentConfirmation(session);

      case "book_appointment":
        return await this.bookAppointment(session);

      case "find_appointments":
        return await this.generateExistingAppointments(
          session,
          analysis.intent
        );

      case "handle_inquiry":
        return await this.generateKnowledgeResponse(userInput, session);

      default:
        return await this.generateContextualResponse(
          userInput,
          session,
          conversationHistory
        );
    }
  }

  generateGreeting() {
    return "Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?";
  }

  generateAppointmentTypeRequest() {
    return "I'd be happy to help you schedule an appointment. What type of appointment are you looking for today? For example, a routine checkup, follow-up visit, or urgent care?";
  }

  generateSpecialtyRequest() {
    return "What type of provider would you like to see? We have primary care, cardiology, dermatology, orthopedics, and pediatrics available.";
  }

  generatePatientInfoRequest(extractedData) {
    const missing = [];
    if (!extractedData.firstName) missing.push("first name");
    if (!extractedData.phone) missing.push("phone number");

    if (missing.length === 2) {
      return "I'll need to collect some information to schedule your appointment. Could I have your full name and phone number?";
    } else if (missing.includes("first name")) {
      return "I still need your name to complete the scheduling. What's your full name?";
    } else if (missing.includes("phone number")) {
      return "I still need your phone number to complete the scheduling. What's the best number to reach you at?";
    } else {
      return "Thank you! Let me check availability for you.";
    }
  }

  generateTimePreferenceRequest() {
    return "When would you prefer to schedule your appointment? You can tell me a specific day like Monday, or a time like two PM, or just say 'as soon as possible'.";
  }

  async generateAvailableSlots(session) {
    try {
      const { specialty, appointmentType, preferredDay, preferredTime } =
        session.extractedData;

      // Find providers for the specialty
      const providers = await this.appointmentService.getProviders(specialty);

      if (providers.length === 0) {
        return `I apologize, but I don't see any available providers for ${specialty} right now. Would you like me to check for other specialties or transfer you to our scheduling team?`;
      }

      // Get availability for the first available provider
      const provider = providers[0];
      const startDate =
        preferredDay === "today" ? new Date() : addDays(new Date(), 1);
      const availability = await this.appointmentService.getAvailabilityRange(
        provider.id,
        startDate,
        14,
        appointmentType
      );

      if (Object.keys(availability).length === 0) {
        return `I don't see any available appointments with ${provider.title} ${provider.lastName} in the next two weeks. Would you like me to check with another provider or look further out?`;
      }

      // Format the first few available slots
      const availableDates = Object.keys(availability).slice(0, 3);
      const slotOptions = availableDates
        .map((date, index) => {
          const dayInfo = availability[date];
          const firstSlot = dayInfo.slots[0];
          return `${index + 1}: ${dayInfo.date} at ${firstSlot.formatted}`;
        })
        .join(", ");

      // Store provider info and availability in session
      session.appointmentData.providerId = provider.id;
      session.appointmentData.providerName = `${provider.title} ${provider.firstName} ${provider.lastName}`;
      session.appointmentData.availability = availability;
      session.appointmentData.availableDates = availableDates;

      return `I have these available appointments with ${provider.title} ${
        provider.lastName
      } for ${appointmentType
        .toLowerCase()
        .replace(
          "_",
          " "
        )}: ${slotOptions}. Which time would work best for you? Just say "option 1", "option 2", or "option 3".`;
    } catch (error) {
      console.error("Error generating available slots:", error);
      return "I'm having trouble checking availability right now. Let me transfer you to our scheduling team who can help you find the perfect appointment time.";
    }
  }

  async generateAppointmentConfirmation(session) {
    try {
      const { selectedSlotIndex } = session.extractedData;
      const { availability, availableDates, providerName } =
        session.appointmentData;

      if (
        selectedSlotIndex === undefined ||
        !availableDates ||
        selectedSlotIndex >= availableDates.length
      ) {
        return "I didn't catch which appointment time you selected. Could you please say 'option 1', 'option 2', or 'option 3'?";
      }

      const selectedDate = availableDates[selectedSlotIndex];
      const selectedDayInfo = availability[selectedDate];
      const selectedSlot = selectedDayInfo.slots[0];

      // Store the selected slot
      session.appointmentData.selectedSlot = {
        dateTime: selectedSlot.dateTime,
        duration: selectedSlot.duration,
        formatted: selectedSlot.formatted,
        dayFormatted: selectedSlot.dayFormatted,
      };

      const appointmentType =
        session.extractedData.appointmentType || "appointment";

      return `Perfect! Let me confirm your appointment details: ${appointmentType
        .toLowerCase()
        .replace("_", " ")} with ${providerName} on ${
        selectedSlot.dayFormatted
      } at ${
        selectedSlot.formatted
      }. Is this correct? Say 'yes' to book this appointment or 'no' to choose a different time.`;
    } catch (error) {
      console.error("Error generating appointment confirmation:", error);
      return "I'm having trouble confirming the appointment details. Could you please repeat which time slot you'd prefer?";
    }
  }

  async bookAppointment(session) {
    try {
      console.log("📅 Booking appointment for session:", session.callSid);

      const { firstName, lastName, phone, appointmentType } =
        session.extractedData;
      const { providerId, selectedSlot } = session.appointmentData;

      // Validate required data
      if (!firstName || !phone || !providerId || !selectedSlot) {
        console.error("❌ Missing required booking data:", {
          firstName,
          phone,
          providerId,
          selectedSlot: !!selectedSlot,
        });
        return "I'm sorry, I'm missing some information needed to book your appointment. Let me start over and collect your details again.";
      }

      // Create appointment in database
      const appointmentData = {
        patientInfo: {
          firstName,
          lastName: lastName || "Unknown",
          phone,
          email: session.extractedData.email || null,
          dateOfBirth: new Date("1990-01-01"), // Default if not provided
        },
        providerId,
        dateTime: selectedSlot.dateTime,
        appointmentType: appointmentType || "FOLLOW_UP",
        reasonForVisit: "Scheduled via voice assistant",
        duration: selectedSlot.duration,
      };

      console.log("📝 Creating appointment with data:", appointmentData);

      const newAppointment = await this.appointmentService.scheduleAppointment(
        appointmentData
      );

      if (newAppointment) {
        console.log(
          "✅ Appointment created successfully:",
          newAppointment.confirmationCode
        );

        // Send SMS confirmation
        await this.sendAppointmentSMS(newAppointment, session.extractedData);

        // Format appointment details for voice
        const appointmentDetails =
          this.appointmentService.formatAppointmentForVoice(newAppointment);
        const confirmationCode = newAppointment.confirmationCode;

        // Clear session data
        session.step = "completed";

        return `Excellent! Your appointment has been successfully scheduled. Here are your details: ${
          appointmentDetails.formatted
        }. Your confirmation code is ${confirmationCode
          .split("")
          .join(
            " "
          )}. I've also sent these details to your phone via text message. Please arrive fifteen minutes early with your insurance card and photo ID. Is there anything else I can help you with today?`;
      } else {
        throw new Error("Failed to create appointment");
      }
    } catch (error) {
      console.error("❌ Error booking appointment:", error);

      if (error.message.includes("no longer available")) {
        return "I apologize, but that time slot is no longer available. Let me show you other available times. Would you like me to check for different appointment slots?";
      } else {
        return "I apologize, but I'm having trouble completing your appointment booking right now. Please call our office directly at your convenience, and our scheduling team will be happy to help you. Your information has been saved, so they can assist you quickly.";
      }
    }
  }

  async sendAppointmentSMS(appointment, patientData) {
    try {
      if (!twilioClient) {
        console.warn("⚠️ Twilio not configured for SMS sending");
        return false;
      }

      const appointmentDetails =
        this.appointmentService.formatAppointmentForVoice(appointment);

      // Format phone number for India (+91)
      let phoneNumber = patientData.phone;
      if (!phoneNumber.startsWith("+")) {
        phoneNumber = "+91" + phoneNumber;
      }

      const smsMessage = `
🏥 Wellness Partners Appointment Confirmation

📅 Appointment: ${appointmentDetails.formatted}
👨‍⚕️ Provider: ${appointmentDetails.provider}
📍 Location: Wellness Partners Clinic
🆔 Confirmation: ${appointment.confirmationCode}

⏰ Please arrive 15 minutes early
📋 Bring: Insurance card & Photo ID

📞 Questions? Call: ${process.env.CLINIC_PHONE || "+1234567890"}

Thank you for choosing Wellness Partners!
      `.trim();

      console.log(`📱 Sending SMS to: ${phoneNumber}`);

      const message = await twilioClient.messages.create({
        body: smsMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log(`✅ SMS sent successfully. SID: ${message.sid}`);
      return true;
    } catch (error) {
      console.error("❌ Error sending SMS:", error);
      // Don't fail the appointment booking if SMS fails
      return false;
    }
  }

  async generateExistingAppointments(session, intent) {
    try {
      const { phone } = session.extractedData;
      const appointments =
        await this.appointmentService.findPatientAppointments(phone);

      if (appointments.length === 0) {
        return "I don't see any upcoming appointments under that phone number. Would you like to schedule a new appointment instead?";
      }

      const appointmentList = appointments
        .slice(0, 3)
        .map((apt, index) => {
          const formatted =
            this.appointmentService.formatAppointmentForVoice(apt);
          return `${index + 1}: ${formatted.formatted}`;
        })
        .join(", ");

      const actionText =
        intent === "cancel_appointment"
          ? "cancel"
          : intent === "reschedule_appointment"
          ? "reschedule"
          : "review";

      return `I found these upcoming appointments: ${appointmentList}. Which appointment would you like to ${actionText}?`;
    } catch (error) {
      console.error("Error finding appointments:", error);
      return "I'm having trouble looking up your appointments right now. Please try again in a moment or speak with our scheduling team.";
    }
  }

  async generateKnowledgeResponse(userInput, session) {
    try {
      if (!this.ragService.isReady()) {
        return await this.generateContextualResponse(userInput, session);
      }

      const ragResponse = await this.ragService.queryKnowledge(userInput, {
        intent: session.intent,
        step: session.step,
      });

      if (ragResponse.confidence > 50) {
        return ragResponse.answer;
      } else {
        // Fallback to contextual response if confidence is low
        return await this.generateContextualResponse(userInput, session);
      }
    } catch (error) {
      console.error("Error generating knowledge response:", error);
      return await this.generateContextualResponse(userInput, session);
    }
  }

  async generateContextualResponse(
    userInput,
    session,
    conversationHistory = []
  ) {
    try {
      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(userInput, session);

      // Prepare conversation for OpenAI
      const conversation = this.buildConversationHistory(
        enhancedPrompt,
        conversationHistory
      );

      // Get AI response
      const response = await aiResponse(conversation);

      return response;
    } catch (error) {
      console.error("Error generating contextual response:", error);
      return this.getFallbackResponse();
    }
  }

  buildEnhancedPrompt(userInput, session) {
    const rileyPrompt = `You are Riley, a friendly and professional appointment scheduling assistant for Wellness Partners, a multi-specialty health clinic.

CURRENT CONVERSATION CONTEXT:
- Intent: ${session.intent || "unknown"}
- Step: ${session.step}
- Collected Information: ${JSON.stringify(session.extractedData)}
- Conversation Count: ${session.conversationCount}

RILEY'S PERSONALITY:
- Warm, professional, and helpful
- Patient and understanding, especially with elderly callers
- Organized and efficient in managing appointments
- Confident and competent with the scheduling system

VOICE RESPONSE GUIDELINES:
- Spell out all numbers (twenty not 20, two thirty PM not 2:30 PM)
- Use clear, conversational language with natural contractions
- No bullet points, emojis, or special symbols
- Ask only one question at a time
- Confirm important information by repeating it back
- End responses with helpful next steps

CLINIC INFORMATION:
- Wellness Partners multi-specialty clinic
- Providers: Dr. Johnson (Primary Care), Dr. Chen (Cardiology), Dr. Rodriguez (Dermatology), Dr. Wilson (Orthopedics), Dr. Davis (Pediatrics)
- Hours: Monday-Friday 8am-5pm, Saturday 9am-12pm for some services
- 24-hour cancellation policy with fifty dollar late fee
- New patients arrive 20 minutes early, returning patients 15 minutes early

USER INPUT: ${userInput}

Respond as Riley, focusing on appointment scheduling while being helpful and conversational:`;

    return rileyPrompt;
  }

  buildConversationHistory(enhancedPrompt, conversationHistory = []) {
    const SYSTEM_PROMPT =
      "You are Riley, an appointment scheduling assistant for Wellness Partners clinic. Always respond in a voice-friendly manner, spelling out numbers and avoiding special characters. Keep responses conversational and helpful.";

    const conversation = [{ role: "system", content: SYSTEM_PROMPT }];

    // Add recent conversation history (last 6 exchanges)
    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach((exchange) => {
      if (exchange.role && exchange.content) {
        conversation.push(exchange);
      }
    });

    // Add current enhanced prompt
    conversation.push({ role: "user", content: enhancedPrompt });

    return conversation;
  }

  async logConversation(callSid, userInput, aiResponse, analysis) {
    try {
      const session = this.conversationSessions.get(callSid);
      await this.appointmentService.logConversation(
        callSid,
        userInput,
        aiResponse,
        analysis.intent,
        analysis.extractedData,
        session?.step
      );
    } catch (error) {
      console.error("Error logging conversation:", error);
    }
  }

  getFallbackResponse() {
    return "I apologize, but I'm having trouble processing your request right now. Let me transfer you to one of our scheduling specialists who can help you immediately.";
  }

  // Cleanup old sessions
  cleanupSessions() {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    for (const [callSid, session] of this.conversationSessions.entries()) {
      if (session.lastActivity < cutoff) {
        this.conversationSessions.delete(callSid);
      }
    }
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.initialized,
      ragServiceReady: this.ragService.isReady(),
      activeSessions: this.conversationSessions.size,
      ragStatus: this.ragService.getStatus(),
    };
  }
}
