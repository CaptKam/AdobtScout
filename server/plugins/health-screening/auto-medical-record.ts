import { eventBus, MedicalRecordAutoCreatePayload } from '../../events/event-bus';
import { db } from '../../db';
import * as schema from '@shared/schema';

interface CreatedMedicalRecord {
  id: string;
  bodyArea?: string;
  concern?: string;
  severity?: string;
  general?: boolean;
}

async function handleAutoCreateMedicalRecords(payload: MedicalRecordAutoCreatePayload): Promise<void> {
  const { dogId, userId, screeningId, result, intakeRecordId } = payload;
  
  const createdRecords: CreatedMedicalRecord[] = [];

  try {
    if (result.concernsByArea && result.concernsByArea.length > 0) {
      for (const concern of result.concernsByArea) {
        if (['moderate', 'high', 'critical'].includes(concern.severity)) {
          try {
            const medicalRecord = await db.insert(schema.medicalRecords)
              .values({
                dogId,
                shelterId: userId,
                recordType: 'exam',
                source: 'ai_intake_screening',
                sourceScreeningId: screeningId,
                title: `AI Intake Alert: ${concern.bodyArea} - ${concern.concern}`,
                description: `Detected during intake health screening.\n\nConcern: ${concern.concern}\nSeverity: ${concern.severity}\nRecommended Action: ${concern.actionNeeded}`,
                status: 'pending',
                performedAt: new Date(),
                performedBy: userId,
              })
              .returning();
            
            if (medicalRecord[0]) {
              createdRecords.push({
                id: medicalRecord[0].id,
                bodyArea: concern.bodyArea,
                concern: concern.concern,
                severity: concern.severity,
              });
            }
          } catch (recordError) {
            console.error(`[Auto Medical Record] Failed to create record for ${concern.bodyArea}:`, recordError);
          }
        }
      }
    }

    if (['high', 'critical'].includes(result.severity) && createdRecords.length === 0) {
      try {
        const medicalRecord = await db.insert(schema.medicalRecords)
          .values({
            dogId,
            shelterId: userId,
            recordType: 'exam',
            source: 'ai_intake_screening',
            sourceScreeningId: screeningId,
            title: `AI Intake Alert: Health Concerns Detected`,
            description: `Detected during intake health screening.\n\n${result.analysis}\n\nConditions: ${result.conditions?.join(', ') || 'See analysis'}\nRecommendation: ${result.recommendation}`,
            status: 'pending',
            performedAt: new Date(),
            performedBy: userId,
          })
          .returning();
        
        if (medicalRecord[0]) {
          createdRecords.push({
            id: medicalRecord[0].id,
            severity: result.severity,
            general: true,
          });
        }
      } catch (recordError) {
        console.error(`[Auto Medical Record] Failed to create general record:`, recordError);
      }
    }

    console.log(`[Auto Medical Record] Created ${createdRecords.length} medical records from screening ${screeningId}`);
  } catch (error) {
    console.error('[Auto Medical Record] Error creating medical records:', error);
  }
}

export function registerAutoMedicalRecord(): void {
  eventBus.on('health_screening.auto_medical_records', handleAutoCreateMedicalRecords);
  console.log('[Health Screening Plugin] Auto Medical Record creator registered');
}

export function unregisterAutoMedicalRecord(): void {
  eventBus.off('health_screening.auto_medical_records', handleAutoCreateMedicalRecords);
  console.log('[Health Screening Plugin] Auto Medical Record creator unregistered');
}

export function getCreatedMedicalRecordsSync(
  dogId: string,
  userId: string,
  screeningId: string,
  result: any
): Promise<CreatedMedicalRecord[]> {
  return new Promise(async (resolve) => {
    const createdRecords: CreatedMedicalRecord[] = [];

    try {
      if (result.concernsByArea && result.concernsByArea.length > 0) {
        for (const concern of result.concernsByArea) {
          if (['moderate', 'high', 'critical'].includes(concern.severity)) {
            try {
              const medicalRecord = await db.insert(schema.medicalRecords)
                .values({
                  dogId,
                  shelterId: userId,
                  recordType: 'exam',
                  source: 'ai_intake_screening',
                  sourceScreeningId: screeningId,
                  title: `AI Intake Alert: ${concern.bodyArea} - ${concern.concern}`,
                  description: `Detected during intake health screening.\n\nConcern: ${concern.concern}\nSeverity: ${concern.severity}\nRecommended Action: ${concern.actionNeeded}`,
                  status: 'pending',
                  performedAt: new Date(),
                  performedBy: userId,
                })
                .returning();
              
              if (medicalRecord[0]) {
                createdRecords.push({
                  id: medicalRecord[0].id,
                  bodyArea: concern.bodyArea,
                  concern: concern.concern,
                  severity: concern.severity,
                });
              }
            } catch (recordError) {
              console.error(`[Auto Medical Record] Failed to create record for ${concern.bodyArea}:`, recordError);
            }
          }
        }
      }

      if (['high', 'critical'].includes(result.severity) && createdRecords.length === 0) {
        try {
          const medicalRecord = await db.insert(schema.medicalRecords)
            .values({
              dogId,
              shelterId: userId,
              recordType: 'exam',
              source: 'ai_intake_screening',
              sourceScreeningId: screeningId,
              title: `AI Intake Alert: Health Concerns Detected`,
              description: `Detected during intake health screening.\n\n${result.analysis}\n\nConditions: ${result.conditions?.join(', ') || 'See analysis'}\nRecommendation: ${result.recommendation}`,
              status: 'pending',
              performedAt: new Date(),
              performedBy: userId,
            })
            .returning();
          
          if (medicalRecord[0]) {
            createdRecords.push({
              id: medicalRecord[0].id,
              severity: result.severity,
              general: true,
            });
          }
        } catch (recordError) {
          console.error(`[Auto Medical Record] Failed to create general record:`, recordError);
        }
      }

      console.log(`[Auto Medical Record] Created ${createdRecords.length} medical records from screening ${screeningId}`);
    } catch (error) {
      console.error('[Auto Medical Record] Error:', error);
    }

    resolve(createdRecords);
  });
}
