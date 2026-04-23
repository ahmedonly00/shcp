package rw.shcp.users.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record DocumentEntryRequest(
        @JsonProperty("title") String title,
        @JsonProperty("date") String date,
        @JsonProperty("fileUrl") String fileUrl,
        @JsonProperty("storedName") String storedName,
        @JsonProperty("contentType") String contentType
) {}
