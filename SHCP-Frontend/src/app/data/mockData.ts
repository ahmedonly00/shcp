import { User, Appointment, SymptomCheck, HealthRecord, Notification, VitalSign } from '@/app/types';

export const mockUsers: User[] = [
  {
    id: 'patient-1',
    name: 'Jean Marie Uwimana',
    email: 'jean.uwimana@email.com',
    role: 'patient',
    phone: '+250 788 123 456',
    verified: true,
    twoFactorEnabled: true,
    avatar: 'https://i.pravatar.cc/150?img=12'
  },
  {
    id: 'doctor-1',
    name: 'Dr. Grace Mugisha',
    email: 'grace.mugisha@hospital.rw',
    role: 'doctor',
    specialization: 'General Medicine',
    phone: '+250 788 987 654',
    verified: true,
    avatar: 'https://i.pravatar.cc/150?img=45'
  },
  {
    id: 'doctor-2',
    name: 'Dr. Eric Nshimiyimana',
    email: 'eric.nshimiyimana@hospital.rw',
    role: 'doctor',
    specialization: 'Cardiology',
    phone: '+250 788 456 789',
    verified: true,
    avatar: 'https://i.pravatar.cc/150?img=33'
  },
  {
    id: 'doctor-3',
    name: 'Dr. Alice Mukamana',
    email: 'alice.mukamana@hospital.rw',
    role: 'doctor',
    specialization: 'Pediatrics',
    phone: '+250 788 321 654',
    verified: true,
    avatar: 'https://i.pravatar.cc/150?img=47'
  },
  {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@shcp.rw',
    role: 'admin',
    verified: true,
    avatar: 'https://i.pravatar.cc/150?img=68'
  }
];

export const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    patientId: 'patient-1',
    patientName: 'Jean Marie Uwimana',
    doctorId: 'doctor-1',
    doctorName: 'Dr. Grace Mugisha',
    doctorSpecialization: 'General Medicine',
    date: '2026-01-22',
    time: '10:00 AM',
    type: 'video',
    status: 'scheduled',
    reason: 'General checkup and follow-up on previous consultation',
    duration: 30
  },
  {
    id: 'apt-2',
    patientId: 'patient-1',
    patientName: 'Jean Marie Uwimana',
    doctorId: 'doctor-2',
    doctorName: 'Dr. Eric Nshimiyimana',
    doctorSpecialization: 'Cardiology',
    date: '2026-01-25',
    time: '2:00 PM',
    type: 'video',
    status: 'scheduled',
    reason: 'Heart health consultation',
    duration: 45
  },
  {
    id: 'apt-3',
    patientId: 'patient-1',
    patientName: 'Jean Marie Uwimana',
    doctorId: 'doctor-1',
    doctorName: 'Dr. Grace Mugisha',
    doctorSpecialization: 'General Medicine',
    date: '2026-01-15',
    time: '3:00 PM',
    type: 'video',
    status: 'completed',
    reason: 'Persistent headache',
    duration: 30
  }
];

export const mockSymptomChecks: SymptomCheck[] = [
  {
    id: 'sym-1',
    userId: 'patient-1',
    date: '2026-01-20',
    symptoms: ['Headache', 'Fatigue', 'Dizziness'],
    severity: 'moderate',
    duration: '3 days',
    bodyLocation: 'Head - Frontal region',
    aiAssessment: {
      possibleConditions: ['Tension Headache', 'Migraine', 'Dehydration'],
      confidence: 75,
      recommendation: 'consult-doctor',
      details: 'Based on your symptoms, you may be experiencing tension headaches or mild migraine. Consider consulting a doctor if symptoms persist for more than 5 days or worsen.'
    }
  },
  {
    id: 'sym-2',
    userId: 'patient-1',
    date: '2026-01-10',
    symptoms: ['Cough', 'Sore throat', 'Mild fever'],
    severity: 'mild',
    duration: '2 days',
    aiAssessment: {
      possibleConditions: ['Common Cold', 'Upper Respiratory Infection'],
      confidence: 85,
      recommendation: 'self-care',
      details: 'Your symptoms suggest a common cold. Rest, stay hydrated, and monitor your temperature. Seek medical attention if symptoms worsen or persist beyond a week.'
    }
  }
];

export const mockHealthRecords: HealthRecord[] = [
  {
    id: 'hr-1',
    userId: 'patient-1',
    type: 'prescription',
    date: '2026-01-15',
    title: 'Headache Medication',
    description: 'Prescription following consultation for persistent headaches',
    doctor: 'Dr. Grace Mugisha',
    medications: [
      {
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '5 days',
        instructions: 'Take after meals with water'
      },
      {
        name: 'Ibuprofen',
        dosage: '200mg',
        frequency: 'As needed',
        duration: '7 days',
        instructions: 'Do not exceed 3 tablets per day'
      }
    ]
  },
  {
    id: 'hr-2',
    userId: 'patient-1',
    type: 'lab-result',
    date: '2026-01-10',
    title: 'Complete Blood Count (CBC)',
    description: 'Routine blood work results',
    doctor: 'Dr. Grace Mugisha',
    attachments: ['cbc-results.pdf']
  },
  {
    id: 'hr-3',
    userId: 'patient-1',
    type: 'allergy',
    date: '2025-06-15',
    title: 'Penicillin Allergy',
    description: 'Patient reports allergic reaction to penicillin-based antibiotics. Documented for future reference.',
    doctor: 'Dr. Grace Mugisha'
  },
  {
    id: 'hr-4',
    userId: 'patient-1',
    type: 'vaccination',
    date: '2025-12-01',
    title: 'Influenza Vaccine',
    description: 'Annual flu vaccination administered',
    doctor: 'Nurse Clemence Uwase'
  }
];

export const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'patient-1',
    type: 'appointment',
    title: 'Upcoming Appointment Reminder',
    message: 'Your appointment with Dr. Grace Mugisha is scheduled for tomorrow at 10:00 AM',
    date: '2026-01-21T09:00:00',
    read: false
  },
  {
    id: 'notif-2',
    userId: 'patient-1',
    type: 'prescription',
    title: 'Prescription Ready',
    message: 'Your prescription from Dr. Grace Mugisha is ready for pickup at Kigali Pharmacy',
    date: '2026-01-15T14:30:00',
    read: false
  },
  {
    id: 'notif-3',
    userId: 'patient-1',
    type: 'message',
    title: 'New Message from Dr. Grace Mugisha',
    message: 'Please ensure you take your medication as prescribed and let me know if you experience any side effects',
    date: '2026-01-15T15:00:00',
    read: true
  },
  {
    id: 'notif-4',
    userId: 'patient-1',
    type: 'reminder',
    title: 'Medication Reminder',
    message: 'Time to take your Paracetamol (500mg)',
    date: '2026-01-20T08:00:00',
    read: true
  }
];

export const mockVitalSigns: VitalSign[] = [
  { type: 'heart-rate', value: '72', date: '2026-01-20', unit: 'bpm' },
  { type: 'blood-pressure', value: '120/80', date: '2026-01-20', unit: 'mmHg' },
  { type: 'temperature', value: '36.8', date: '2026-01-20', unit: '°C' },
  { type: 'oxygen', value: '98', date: '2026-01-20', unit: '%' },
  { type: 'weight', value: '68.5', date: '2026-01-20', unit: 'kg' },
  { type: 'glucose', value: '95', date: '2026-01-20', unit: 'mg/dL' },
  { type: 'heart-rate', value: '75', date: '2026-01-15', unit: 'bpm' },
  { type: 'blood-pressure', value: '118/78', date: '2026-01-15', unit: 'mmHg' },
  { type: 'weight', value: '68.8', date: '2026-01-15', unit: 'kg' },
];

// Generate dynamic doctor availability for the next 30 days
const generateDoctorAvailability = () => {
  const availability: any = {};
  const today = new Date();
  
  ['doctor-1', 'doctor-2', 'doctor-3'].forEach((doctorId) => {
    availability[doctorId] = [];
    
    // Generate availability for next 30 days
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Skip Sundays
      if (date.getDay() !== 0) {
        const slots = [
          '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
          '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
        ];
        
        // Randomize availability slightly for realism
        const availableSlots = slots.filter(() => Math.random() > 0.2);
        
        if (availableSlots.length > 0) {
          availability[doctorId].push({
            date: dateStr,
            slots: availableSlots
          });
        }
      }
    }
  });
  
  return availability;
};

export const doctorAvailability = generateDoctorAvailability();

export const symptoms = [
  'Headache', 'Fever', 'Cough', 'Sore throat', 'Fatigue', 'Dizziness', 
  'Nausea', 'Vomiting', 'Diarrhea', 'Chest pain', 'Shortness of breath',
  'Abdominal pain', 'Back pain', 'Joint pain', 'Muscle pain', 'Rash',
  'Loss of appetite', 'Weight loss', 'Difficulty sleeping', 'Anxiety'
];