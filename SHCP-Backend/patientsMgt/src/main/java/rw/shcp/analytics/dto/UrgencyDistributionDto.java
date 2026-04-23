package rw.shcp.analytics.dto;

/**
 * AI-assessed urgency level and the number of symptom reports with that level.
 */
public record UrgencyDistributionDto(String urgencyLevel, long count) {}
