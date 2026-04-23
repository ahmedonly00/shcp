package rw.shcp.analytics.dto;

/**
 * A single data point in a time-series: one date bucket and its count.
 */
public record DailyCountDto(String date, long count) {}
