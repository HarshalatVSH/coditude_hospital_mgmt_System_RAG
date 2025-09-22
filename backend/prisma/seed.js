import { PrismaClient } from "@prisma/client";
import { addDays, setHours, setMinutes } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create Providers
  console.log("Creating providers...");
  const providers = await Promise.all([
    prisma.provider.create({
      data: {
        firstName: "Sarah",
        lastName: "Johnson",
        title: "Dr.",
        specialty: "Primary Care",
        phoneExt: "101",
        email: "sarah.johnson@wellnesspartners.com",
        isActive: true,
      },
    }),
    prisma.provider.create({
      data: {
        firstName: "Michael",
        lastName: "Chen",
        title: "Dr.",
        specialty: "Cardiology",
        phoneExt: "102",
        email: "michael.chen@wellnesspartners.com",
        isActive: true,
      },
    }),
    prisma.provider.create({
      data: {
        firstName: "Lisa",
        lastName: "Rodriguez",
        title: "Dr.",
        specialty: "Dermatology",
        phoneExt: "103",
        email: "lisa.rodriguez@wellnesspartners.com",
        isActive: true,
      },
    }),
    prisma.provider.create({
      data: {
        firstName: "James",
        lastName: "Wilson",
        title: "Dr.",
        specialty: "Orthopedics",
        phoneExt: "104",
        email: "james.wilson@wellnesspartners.com",
        isActive: true,
      },
    }),
    prisma.provider.create({
      data: {
        firstName: "Emily",
        lastName: "Davis",
        title: "Dr.",
        specialty: "Pediatrics",
        phoneExt: "105",
        email: "emily.davis@wellnesspartners.com",
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${providers.length} providers`);

  // Create Working Hours for each provider
  console.log("Creating working hours...");
  for (const provider of providers) {
    // Different schedule for different providers
    let workingDays = [];

    if (provider.specialty === "Primary Care") {
      // Primary care: Mon-Fri 8am-5pm, Sat 9am-12pm
      workingDays = [
        { dayOfWeek: 1, startTime: "08:00", endTime: "17:00" }, // Monday
        { dayOfWeek: 2, startTime: "08:00", endTime: "17:00" }, // Tuesday
        { dayOfWeek: 3, startTime: "08:00", endTime: "17:00" }, // Wednesday
        { dayOfWeek: 4, startTime: "08:00", endTime: "17:00" }, // Thursday
        { dayOfWeek: 5, startTime: "08:00", endTime: "17:00" }, // Friday
        { dayOfWeek: 6, startTime: "09:00", endTime: "12:00" }, // Saturday
      ];
    } else if (provider.specialty === "Cardiology") {
      // Cardiology: Tue-Thu 9am-4pm
      workingDays = [
        { dayOfWeek: 2, startTime: "09:00", endTime: "16:00" }, // Tuesday
        { dayOfWeek: 3, startTime: "09:00", endTime: "16:00" }, // Wednesday
        { dayOfWeek: 4, startTime: "09:00", endTime: "16:00" }, // Thursday
      ];
    } else if (provider.specialty === "Dermatology") {
      // Dermatology: Mon, Wed, Fri 9am-3pm
      workingDays = [
        { dayOfWeek: 1, startTime: "09:00", endTime: "15:00" }, // Monday
        { dayOfWeek: 3, startTime: "09:00", endTime: "15:00" }, // Wednesday
        { dayOfWeek: 5, startTime: "09:00", endTime: "15:00" }, // Friday
      ];
    } else if (provider.specialty === "Pediatrics") {
      // Pediatrics: Mon-Fri 9am-5pm, Sat 9am-12pm
      workingDays = [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, // Monday
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" }, // Tuesday
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }, // Wednesday
        { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Thursday
        { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }, // Friday
        { dayOfWeek: 6, startTime: "09:00", endTime: "12:00" }, // Saturday
      ];
    } else {
      // Default: Mon-Fri 8am-4pm
      workingDays = [
        { dayOfWeek: 1, startTime: "08:00", endTime: "16:00" }, // Monday
        { dayOfWeek: 2, startTime: "08:00", endTime: "16:00" }, // Tuesday
        { dayOfWeek: 3, startTime: "08:00", endTime: "16:00" }, // Wednesday
        { dayOfWeek: 4, startTime: "08:00", endTime: "16:00" }, // Thursday
        { dayOfWeek: 5, startTime: "08:00", endTime: "16:00" }, // Friday
      ];
    }

    for (const schedule of workingDays) {
      await prisma.workingHours.create({
        data: {
          providerId: provider.id,
          ...schedule,
          isActive: true,
        },
      });
    }
  }
  console.log("✅ Created working hours for all providers");

  // Create some sample patients
  console.log("Creating sample patients...");
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        firstName: "John",
        lastName: "Smith",
        phone: "5551234567",
        email: "john.smith@email.com",
        dateOfBirth: new Date("1985-03-15"),
        isNewPatient: false,
        insuranceProvider: "Blue Cross Blue Shield",
      },
    }),
    prisma.patient.create({
      data: {
        firstName: "Maria",
        lastName: "Garcia",
        phone: "5559876543",
        email: "maria.garcia@email.com",
        dateOfBirth: new Date("1990-07-22"),
        isNewPatient: true,
        insuranceProvider: "Aetna",
      },
    }),
    prisma.patient.create({
      data: {
        firstName: "Robert",
        lastName: "Taylor",
        phone: "5555551234",
        email: "robert.taylor@email.com",
        dateOfBirth: new Date("1978-11-08"),
        isNewPatient: false,
        insuranceProvider: "United Healthcare",
      },
    }),
  ]);

  console.log(`✅ Created ${patients.length} sample patients`);

  // Create some sample appointments
  console.log("Creating sample appointments...");
  const baseDate = new Date();
  const appointments = [];

  // Future appointments
  for (let i = 1; i <= 7; i++) {
    const appointmentDate = addDays(baseDate, i);
    const appointmentTime = setMinutes(setHours(appointmentDate, 10), 0);

    appointments.push(
      prisma.appointment.create({
        data: {
          patientId: patients[i % patients.length].id,
          providerId: providers[i % providers.length].id,
          appointmentType: i % 2 === 0 ? "FOLLOW_UP" : "NEW_PATIENT",
          dateTime: appointmentTime,
          duration: i % 2 === 0 ? 30 : 60,
          status: "SCHEDULED",
          reasonForVisit:
            i % 2 === 0 ? "Follow-up visit" : "Initial consultation",
          confirmationCode: `WP${String(i).padStart(4, "0")}`,
        },
      })
    );
  }

  await Promise.all(appointments);
  console.log(`✅ Created ${appointments.length} sample appointments`);

  // Create some conversation logs for testing
  console.log("Creating sample conversation logs...");
  const conversationLogs = await Promise.all([
    prisma.conversationLog.create({
      data: {
        callSid: "CA1234567890abcdef",
        userInput: "I need to schedule an appointment",
        aiResponse:
          "I'd be happy to help you schedule an appointment. What type of appointment are you looking for?",
        intent: "schedule_appointment",
        sessionStep: "collect_appointment_type",
        extractedData: { appointmentType: null },
      },
    }),
    prisma.conversationLog.create({
      data: {
        callSid: "CA1234567890abcdef",
        userInput: "Primary care visit",
        aiResponse:
          "Great! I can help you schedule a primary care appointment. May I have your name and phone number?",
        intent: "schedule_appointment",
        sessionStep: "collect_patient_info",
        extractedData: { specialty: "primary care" },
      },
    }),
  ]);

  console.log(`✅ Created ${conversationLogs.length} sample conversation logs`);

  console.log("🎉 Database seeding completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`   - ${providers.length} providers created`);
  console.log(`   - Working hours configured for all providers`);
  console.log(`   - ${patients.length} sample patients created`);
  console.log(`   - ${appointments.length} sample appointments created`);
  console.log(`   - ${conversationLogs.length} conversation logs created`);
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
