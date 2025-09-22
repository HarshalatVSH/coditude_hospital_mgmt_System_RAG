import prisma from "../lib/database.js";
import {
  addMinutes,
  isAfter,
  isBefore,
  format,
  parse,
  startOfDay,
  endOfDay,
  addDays,
} from "date-fns";

export class AppointmentService {
  constructor() {
    this.prisma = prisma;
  }

  // Check if a specific time slot is available
  async isTimeSlotAvailable(providerId, dateTime, duration = 30) {
    try {
      const appointmentStart = new Date(dateTime);
      const appointmentEnd = addMinutes(appointmentStart, duration);

      const conflictingAppointments = await this.prisma.appointment.findMany({
        where: {
          providerId,
          status: {
            in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"],
          },
          OR: [
            {
              // Appointment starts during our requested time
              dateTime: {
                gte: appointmentStart,
                lt: appointmentEnd,
              },
            },
            {
              // Existing appointment runs into our requested time
              AND: [
                { dateTime: { lt: appointmentStart } },
                {
                  // Calculate end time of existing appointment
                  dateTime: {
                    gte: new Date(appointmentStart.getTime() - 60 * 60000), // Assume max 60 min appointments
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          dateTime: true,
          duration: true,
        },
      });

      // Check if any existing appointments actually conflict
      const hasConflict = conflictingAppointments.some((apt) => {
        const existingEnd = addMinutes(new Date(apt.dateTime), apt.duration);
        const requestedStart = appointmentStart;
        const requestedEnd = appointmentEnd;

        // Check for overlap
        return (
          requestedStart < existingEnd && requestedEnd > new Date(apt.dateTime)
        );
      });

      return !hasConflict;
    } catch (error) {
      console.error("Error checking time slot availability:", error);
      return false;
    }
  }

  // Get available time slots for a provider on a specific date
  async getAvailableSlots(providerId, date, appointmentType = "FOLLOW_UP") {
    try {
      const provider = await this.prisma.provider.findUnique({
        where: { id: providerId },
        include: {
          workingHours: {
            where: { isActive: true },
          },
          appointments: {
            where: {
              dateTime: {
                gte: startOfDay(new Date(date)),
                lte: endOfDay(new Date(date)),
              },
              status: {
                in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"],
              },
            },
            select: {
              dateTime: true,
              duration: true,
            },
          },
        },
      });

      if (!provider) {
        throw new Error("Provider not found");
      }

      const dayOfWeek = new Date(date).getDay();
      const workingHours = provider.workingHours.find(
        (wh) => wh.dayOfWeek === dayOfWeek
      );

      if (!workingHours) {
        return []; // Provider doesn't work on this day
      }

      const slots = [];
      const duration = this.getAppointmentDurationByType(appointmentType);

      // Parse working hours
      const [startHour, startMinute] = workingHours.startTime
        .split(":")
        .map(Number);
      const [endHour, endMinute] = workingHours.endTime.split(":").map(Number);

      const startTime = new Date(date);
      startTime.setHours(startHour, startMinute, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(endHour, endMinute, 0, 0);

      // Generate time slots every 15 minutes
      let currentSlot = new Date(startTime);

      while (
        isBefore(addMinutes(currentSlot, duration), endTime) ||
        currentSlot.getTime() === endTime.getTime() - duration * 60000
      ) {
        // Check if this slot is available
        const isAvailable = await this.isTimeSlotAvailable(
          providerId,
          currentSlot,
          duration
        );

        if (isAvailable) {
          slots.push({
            dateTime: new Date(currentSlot),
            duration,
            formatted: format(currentSlot, "h:mm a"),
            dayFormatted: format(currentSlot, "EEEE, MMMM do"),
          });
        }

        // Move to next 15-minute slot
        currentSlot = addMinutes(currentSlot, 15);
      }

      return slots;
    } catch (error) {
      console.error("Error getting available slots:", error);
      return [];
    }
  }

  // Get multiple days of availability for a provider
  async getAvailabilityRange(
    providerId,
    startDate,
    days = 14,
    appointmentType = "FOLLOW_UP"
  ) {
    const availability = {};

    for (let i = 0; i < days; i++) {
      const date = addDays(new Date(startDate), i);
      const dateKey = format(date, "yyyy-MM-dd");

      const slots = await this.getAvailableSlots(
        providerId,
        date,
        appointmentType
      );

      if (slots.length > 0) {
        availability[dateKey] = {
          date: format(date, "EEEE, MMMM do"),
          slots: slots.slice(0, 6), // Limit to first 6 slots per day
        };
      }
    }

    return availability;
  }

  // Create a new appointment
  async scheduleAppointment(appointmentData) {
    try {
      const {
        patientInfo,
        providerId,
        dateTime,
        appointmentType,
        reasonForVisit,
        duration,
      } = appointmentData;

      // Validate required fields
      if (
        !patientInfo?.firstName ||
        !patientInfo?.lastName ||
        !patientInfo?.phone
      ) {
        throw new Error("Patient name and phone number are required");
      }

      if (!providerId || !dateTime) {
        throw new Error("Provider and appointment time are required");
      }

      // Check availability first
      const appointmentDuration =
        duration || this.getAppointmentDurationByType(appointmentType);
      const isAvailable = await this.isTimeSlotAvailable(
        providerId,
        dateTime,
        appointmentDuration
      );

      if (!isAvailable) {
        throw new Error("Selected time slot is no longer available");
      }

      // Find or create patient
      let patient = await this.prisma.patient.findUnique({
        where: { phone: patientInfo.phone },
      });

      if (!patient) {
        patient = await this.prisma.patient.create({
          data: {
            firstName: patientInfo.firstName,
            lastName: patientInfo.lastName,
            phone: patientInfo.phone,
            email: patientInfo.email || null,
            dateOfBirth: patientInfo.dateOfBirth
              ? new Date(patientInfo.dateOfBirth)
              : new Date("1990-01-01"),
            isNewPatient: true,
            insuranceProvider: patientInfo.insuranceProvider || null,
          },
        });
      } else {
        // Update existing patient if new information provided
        patient = await this.prisma.patient.update({
          where: { id: patient.id },
          data: {
            email: patientInfo.email || patient.email,
            insuranceProvider:
              patientInfo.insuranceProvider || patient.insuranceProvider,
            isNewPatient: false,
          },
        });
      }

      // Create appointment
      const appointment = await this.prisma.appointment.create({
        data: {
          patientId: patient.id,
          providerId,
          appointmentType: appointmentType || "FOLLOW_UP",
          dateTime: new Date(dateTime),
          duration: appointmentDuration,
          reasonForVisit: reasonForVisit || "General appointment",
          confirmationCode: this.generateConfirmationCode(),
          status: "SCHEDULED",
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          provider: {
            select: {
              firstName: true,
              lastName: true,
              title: true,
              specialty: true,
            },
          },
        },
      });

      return appointment;
    } catch (error) {
      console.error("Error scheduling appointment:", error);
      throw error;
    }
  }

  // Find appointments by patient phone
  async findPatientAppointments(phone) {
    try {
      const patient = await this.prisma.patient.findUnique({
        where: { phone },
        include: {
          appointments: {
            include: {
              provider: {
                select: {
                  firstName: true,
                  lastName: true,
                  title: true,
                  specialty: true,
                },
              },
            },
            where: {
              dateTime: {
                gte: new Date(), // Only future appointments
              },
            },
            orderBy: {
              dateTime: "asc",
            },
          },
        },
      });

      return patient?.appointments || [];
    } catch (error) {
      console.error("Error finding patient appointments:", error);
      return [];
    }
  }

  // Get all providers, optionally filtered by specialty
  async getProviders(specialty = null) {
    try {
      const where = {
        isActive: true,
      };

      if (specialty) {
        where.specialty = {
          contains: specialty,
          mode: "insensitive",
        };
      }

      const providers = await this.prisma.provider.findMany({
        where,
        include: {
          workingHours: {
            where: { isActive: true },
            orderBy: { dayOfWeek: "asc" },
          },
        },
        orderBy: {
          lastName: "asc",
        },
      });

      return providers;
    } catch (error) {
      console.error("Error getting providers:", error);
      return [];
    }
  }

  // Cancel appointment
  async cancelAppointment(appointmentId, reason = null) {
    try {
      const appointment = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CANCELLED",
          notes: reason ? `Cancelled: ${reason}` : "Cancelled by patient",
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          provider: {
            select: {
              firstName: true,
              lastName: true,
              title: true,
            },
          },
        },
      });

      return appointment;
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      throw error;
    }
  }

  // Reschedule appointment
  async rescheduleAppointment(
    appointmentId,
    newDateTime,
    newProviderId = null
  ) {
    try {
      const existingAppointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!existingAppointment) {
        throw new Error("Appointment not found");
      }

      const providerId = newProviderId || existingAppointment.providerId;
      const isAvailable = await this.isTimeSlotAvailable(
        providerId,
        newDateTime,
        existingAppointment.duration
      );

      if (!isAvailable) {
        throw new Error("New time slot is not available");
      }

      const rescheduledAppointment = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          dateTime: new Date(newDateTime),
          providerId,
          status: "SCHEDULED",
          confirmationCode: this.generateConfirmationCode(),
          notes: `Rescheduled from ${format(
            existingAppointment.dateTime,
            "PPP p"
          )}`,
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          provider: {
            select: {
              firstName: true,
              lastName: true,
              title: true,
              specialty: true,
            },
          },
        },
      });

      return rescheduledAppointment;
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      throw error;
    }
  }

  // Get appointment by confirmation code
  async getAppointmentByConfirmation(confirmationCode) {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { confirmationCode },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          provider: {
            select: {
              firstName: true,
              lastName: true,
              title: true,
              specialty: true,
            },
          },
        },
      });

      return appointment;
    } catch (error) {
      console.error("Error finding appointment by confirmation code:", error);
      return null;
    }
  }

  // Log conversation for analytics
  async logConversation(
    callSid,
    userInput,
    aiResponse,
    intent = null,
    extractedData = null,
    sessionStep = null
  ) {
    try {
      await this.prisma.conversationLog.create({
        data: {
          callSid,
          userInput,
          aiResponse,
          intent,
          extractedData: extractedData ? JSON.stringify(extractedData) : null,
          sessionStep,
        },
      });
    } catch (error) {
      console.error("Error logging conversation:", error);
    }
  }

  // Helper methods
  getAppointmentDurationByType(appointmentType) {
    const durations = {
      NEW_PATIENT: 60,
      FOLLOW_UP: 30,
      URGENT_CARE: 30,
      CONSULTATION: 45,
      PROCEDURE: 90,
      WELLNESS_CHECK: 45,
      TELEHEALTH: 30,
    };

    return durations[appointmentType] || 30;
  }

  generateConfirmationCode() {
    return "WP" + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Format appointment for voice response
  formatAppointmentForVoice(appointment) {
    const date = format(new Date(appointment.dateTime), "EEEE, MMMM do");
    const time = format(new Date(appointment.dateTime), "h:mm a");
    const provider = `${appointment.provider.title} ${appointment.provider.firstName} ${appointment.provider.lastName}`;

    return {
      date,
      time,
      provider,
      specialty: appointment.provider.specialty,
      confirmationCode: appointment.confirmationCode,
      formatted: `${appointment.appointmentType
        .toLowerCase()
        .replace("_", " ")} with ${provider} on ${date} at ${time}`,
    };
  }

  // Get summary statistics
  async getStats() {
    try {
      const stats = await this.prisma.$transaction([
        this.prisma.patient.count(),
        this.prisma.provider.count({ where: { isActive: true } }),
        this.prisma.appointment.count({
          where: {
            dateTime: { gte: new Date() },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
        }),
        this.prisma.appointment.count({
          where: {
            dateTime: { gte: new Date() },
            status: "CANCELLED",
          },
        }),
      ]);

      return {
        totalPatients: stats[0],
        activeProviders: stats[1],
        upcomingAppointments: stats[2],
        cancelledAppointments: stats[3],
      };
    } catch (error) {
      console.error("Error getting stats:", error);
      return null;
    }
  }
}
