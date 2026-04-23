package com.patients.patientsMgt;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import rw.shcp.ShcpApplication;

@SpringBootTest(classes = ShcpApplication.class)
@Disabled("Requires running PostgreSQL — execute against real infrastructure only")
class PatientsMgtApplicationTests {

	@Test
	void contextLoads() {
	}

}
