package rw.shcp.notifications.dto;

import rw.shcp.notifications.NotificationRecord;

import java.util.UUID;

public record NotificationDto(
        UUID   notificationId,
        UUID   userId,
        String type,
        String title,
        String message,
        String date,
        boolean read,
        String channel
) {
    public static NotificationDto from(NotificationRecord r) {
        return new NotificationDto(
                r.getNotificationId(),
                r.getUserId(),
                deriveCategory(r.getType()),
                deriveTitle(r.getType()),
                r.getMessage(),
                r.getCreatedAt().toString(),
                r.isRead(),
                r.getChannel()
        );
    }

    private static String deriveCategory(String eventType) {
        if (eventType == null) return "message";
        if (eventType.startsWith("appointment.") || eventType.startsWith("consultation."))
            return "appointment";
        if (eventType.startsWith("prescription."))
            return "prescription";
        return "message";
    }

    private static String deriveTitle(String eventType) {
        if (eventType == null) return "Notification";
        return switch (eventType) {
            case "appointment.confirmed"    -> "Appointment Confirmed";
            case "appointment.reminder.24h" -> "Appointment Tomorrow";
            case "appointment.reminder.1h"  -> "Appointment in 1 Hour";
            case "consultation.started"     -> "Consultation Started";
            case "consultation.completed"   -> "Consultation Completed";
            case "prescription.issued"      -> "Prescription Issued";
            default -> {
                String[] parts = eventType.split("\\.");
                StringBuilder sb = new StringBuilder();
                for (String p : parts) {
                    if (!p.isBlank()) {
                        sb.append(Character.toUpperCase(p.charAt(0)))
                          .append(p.substring(1)).append(' ');
                    }
                }
                yield sb.toString().trim();
            }
        };
    }
}
