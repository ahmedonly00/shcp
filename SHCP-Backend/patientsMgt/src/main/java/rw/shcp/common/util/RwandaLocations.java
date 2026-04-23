package rw.shcp.common.util;

import java.util.Set;

/**
 * Reference data for Rwanda's administrative hierarchy.
 *
 * <p>Covers all 30 districts across 5 provinces. Used to validate delivery
 * addresses at prescription-issue time so that typos are caught before the
 * nearest-pharmacy cascade runs (a typo in "Gasabo" should not silently fall
 * back to any national pharmacy).</p>
 *
 * <p>Sector / cell validation is intentionally omitted here — the ~416 sectors
 * and ~2148 cells are too granular for a compile-time constant and should be
 * backed by a seeded database table if full validation is required.</p>
 */
public final class RwandaLocations {

    private RwandaLocations() {}

    /** All 30 official districts (case-insensitive comparison done by callers). */
    public static final Set<String> DISTRICTS = Set.of(
            // City of Kigali (3)
            "Gasabo", "Kicukiro", "Nyarugenge",
            // Eastern Province (7)
            "Bugesera", "Gatsibo", "Kayonza", "Kirehe",
            "Ngoma", "Nyagatare", "Rwamagana",
            // Northern Province (5)
            "Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo",
            // Southern Province (9)
            "Gisagara", "Huye", "Kamonyi", "Muhanga",
            "Nyamagabe", "Nyamasheke", "Nyanza", "Nyaruguru", "Ruhango",
            // Western Province (6)
            "Karongi", "Ngororero", "Nyabihu", "Rubavu", "Rusizi", "Rutsiro"
    );

    /**
     * Returns {@code true} when {@code district} is a recognised Rwanda district.
     * Comparison is case-insensitive.
     */
    public static boolean isKnownDistrict(String district) {
        if (district == null || district.isBlank()) return false;
        return DISTRICTS.stream()
                .anyMatch(d -> d.equalsIgnoreCase(district.trim()));
    }
}
