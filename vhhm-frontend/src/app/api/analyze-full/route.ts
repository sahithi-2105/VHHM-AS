import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL();
    const req = await request.json();
    const { user_id, name, age, gender, heart_rate, body_temp, oxygen_level, bp, water_intake, sleep_hours, reason_for_visit } = req;

    let score = 100;
    const meds: any[] = [];
    const remedies: string[] = [];
    const exercises: string[] = [];

    const reason = (reason_for_visit || '').toLowerCase();

    // ─── FEVER & PAIN ───
    if (['fever', 'temp', 'chills'].some(x => reason.includes(x)) || body_temp > 100) {
      meds.push({ name: 'Paracetamol (Acetaminophen)', dosage: '500mg', duration: '3 Days', instructions: 'One tablet every 6 hours after meals' });
      remedies.push('Lukewarm water compresses on forehead');
      score -= 20;
    }

    if (['headache', 'body ache', 'pain'].some(x => reason.includes(x))) {
      meds.push({ name: 'Ibuprofen (Advil/Motrin)', dosage: '400mg', duration: '2 Days', instructions: 'One tablet every 8 hours as needed for pain' });
      remedies.push('Rest in a quiet, dimly lit environment');
      score -= 10;
    }

    // ─── COLD & COUGH ───
    if (['cold', 'sneezing', 'nasal', 'congestion'].some(x => reason.includes(x))) {
      meds.push({ name: 'Cetirizine (Zyrtec)', dosage: '10mg', duration: '5 Days', instructions: 'One tablet at bedtime' });
      meds.push({ name: 'Oxymetazoline Nasal Spray', dosage: '0.05%', duration: '3 Days', instructions: '1-2 sprays in each nostril twice daily' });
      remedies.push('Steam inhalation twice daily');
      score -= 15;
    }

    if (reason.includes('cough')) {
      if (reason.includes('dry')) {
        meds.push({ name: 'Dextromethorphan (Benadryl Dry)', dosage: '10ml', duration: '3 Days', instructions: 'Twice daily after meals' });
      } else {
        meds.push({ name: 'Guaifenesin (Mucinex)', dosage: '600mg', duration: '5 Days', instructions: 'One tablet every 12 hours with a full glass of water' });
      }
      remedies.push('Warm salt water gargles');
      score -= 10;
    }

    // ─── CANCER (Critical Handling) ───
    if (['cancer', 'tumor', 'malignant', 'biopsy'].some(x => reason.includes(x))) {
      meds.push({ name: 'URGENT ONCOLOGICAL CONSULTATION', dosage: 'Specialized Protocol', duration: 'Immediate', instructions: 'CRITICAL: Urgent referral to an Oncologist for staging and treatment plan (Chemo/Radiation/Surgery)' });
      meds.push({ name: 'Ondansetron (Zofran)', dosage: '4mg', duration: 'As Needed', instructions: 'For nausea management during consultation phase' });
      remedies.push('Schedule PET scan and Biopsy immediately');
      score = 30;
    }

    // ─── DIABETES & HYPERTENSION ───
    if (reason.includes('diabetes') || reason.includes('sugar')) {
      meds.push({ name: 'Metformin (Glucophage)', dosage: '500mg', duration: 'Ongoing', instructions: 'Once daily with evening meal' });
      remedies.push('Strict low-glycemic index diet');
      exercises.push('Daily 30-min brisk walk');
      score -= 15;
    }

    if (reason.includes('hypertension') || reason.includes('blood pressure') || reason.includes('bp')) {
      meds.push({ name: 'Amlodipine (Norvasc)', dosage: '5mg', duration: 'Ongoing', instructions: 'Once daily in the morning' });
      remedies.push('Low-sodium diet (DASH diet)');
      score -= 15;
    }

    // ─── GENERAL VITALS CHECK ───
    if (oxygen_level < 94) {
      remedies.push('Increase air circulation and perform deep breathing');
      score -= 30;
    }

    if (water_intake < 2000) {
      remedies.push('Oral Rehydration Salts (ORS) - 1 sachet in 1L water');
      exercises.push('Light stretching to improve circulation');
      score -= 5;
    }

    const diagnosis = score > 85 ? 'Stable' : score > 65 ? 'Monitoring Required' : 'Medical Intervention Required';

    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    await sql`
      INSERT INTO health_logs (user_id, timestamp, hr, bp, oxygen, water, sleep, reason, diagnosis, prescription, remedies, exercises)
      VALUES (${user_id}, ${timestamp}, ${heart_rate}, ${bp}, ${oxygen_level}, ${water_intake}, ${sleep_hours}, ${reason_for_visit}, ${diagnosis}, ${JSON.stringify(meds)}, ${JSON.stringify(remedies)}, ${JSON.stringify(exercises)})
    `;

    return NextResponse.json({
      diagnosis,
      score,
      prescription: meds,
      remedies,
      exercises,
      summary: `Based on your symptoms (${reason_for_visit}), we've generated a specific recovery plan.`,
    });
  } catch (e: any) {
    console.error('Analyze error:', e);
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 });
  }
}
