package rw.shcp.common.util;

/**
 * Haversine great-circle distance formula.
 * Used for GPS-based tiebreaking when multiple pharmacies match at the same
 * Rwanda administrative level (district / sector / cell).
 */
public final class HaversineUtils {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private HaversineUtils() {}

    /**
     * Returns the distance in kilometres between two WGS-84 coordinates.
     *
     * @param lat1 latitude of point A (degrees)
     * @param lon1 longitude of point A (degrees)
     * @param lat2 latitude of point B (degrees)
     * @param lon2 longitude of point B (degrees)
     */
    public static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                   * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2.0 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
    }
}
