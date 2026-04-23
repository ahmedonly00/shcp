package rw.shcp.users.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Each field is an optional JSON-string replacement for the corresponding EHR section.
 * Null fields are left unchanged.
 */
public record UpdateEhrRequest(
        @JsonProperty("diagnoses") String diagnoses,
        @JsonProperty("medications") String medications,
        @JsonProperty("allergies") String allergies,
        @JsonProperty("vitals") String vitals,
        @JsonProperty("immunizations") String immunizations,
        @JsonProperty("labResults") String labResults,
        @JsonProperty("documents") String documents,
        @JsonProperty("goals") String goals,
        @JsonProperty("activityLogs") String activityLogs
) {}
