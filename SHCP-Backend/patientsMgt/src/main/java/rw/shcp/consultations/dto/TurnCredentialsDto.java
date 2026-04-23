package rw.shcp.consultations.dto;

import java.util.List;

/**
 * ICE server configuration returned by the TURN-credentials endpoint.
 * The frontend uses this directly as the RTCConfiguration.iceServers array.
 */
public record TurnCredentialsDto(List<IceServer> iceServers) {

    public record IceServer(List<String> urls, String username, String credential) {}
}
