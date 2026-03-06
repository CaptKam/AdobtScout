import type { Express } from "express";
import { storage } from "../storage";
import type { User } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, and, or, sql, isNull, isNotNull, gt, gte, lte, desc, inArray, not } from "drizzle-orm";
import { db } from "../db";
import crypto from "crypto";
import { isAuthenticated } from "../auth";
import { initiatePhoneScreening } from "../vapi";
import { emitAnalyzeRequest, isPluginEnabled, getCreatedMedicalRecordsSync } from "../plugins/health-screening";
import { eventBus } from "../events/event-bus";

export function registerShelterRoutes(app: Express) {
  // Get shelter's installed plugins
  app.get('/api/shelter/plugins', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can manage plugins" });
      }

      const installations = await storage.getShelterPluginInstallations(user.id);
      res.json(installations);
    } catch (error: any) {
      console.error("Error fetching shelter plugins:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Install a plugin
  app.post('/api/shelter/plugins/install', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can install plugins" });
      }

      const { pluginId, config } = req.body;
      
      // Verify plugin exists
      const plugin = await storage.getPlugin(pluginId);
      if (!plugin) {
        return res.status(404).json({ message: "Plugin not found" });
      }

      // Generate webhook secret
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      const installation = await storage.installPlugin({
        pluginId,
        shelterId: user.id,
        config: config || {},
        webhookSecret,
        isActive: true,
      });

      res.status(201).json(installation);
    } catch (error: any) {
      console.error("Error installing plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update plugin configuration
  app.put('/api/shelter/plugins/:id/config', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can manage plugins" });
      }

      const { id } = req.params;
      const { config } = req.body;

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      const updated = await storage.updatePluginInstallation(id, { config });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating plugin config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Uninstall a plugin
  app.delete('/api/shelter/plugins/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can manage plugins" });
      }

      const { id } = req.params;

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      await storage.uninstallPlugin(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error uninstalling plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });


  // Get webhook logs for an installation
  app.get('/api/shelter/plugins/:id/logs', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can view logs" });
      }

      const { id } = req.params;

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      const logs = await storage.getWebhookLogs(id);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching webhook logs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Trigger outgoing webhook (for shelter to send data to plugin)
  app.post('/api/shelter/plugins/:id/trigger', isAuthenticated, async (req: any, res) => {
    const startTime = Date.now();
    const { id } = req.params;
    
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can trigger webhooks" });
      }

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      const plugin = await storage.getPlugin(installation.pluginId);
      if (!plugin || !plugin.webhookUrl) {
        return res.status(400).json({ message: "Plugin does not support webhooks" });
      }

      const { event, data } = req.body;

      // Create signature
      const signature = crypto
        .createHmac('sha256', installation.webhookSecret!)
        .update(JSON.stringify({ event, data }))
        .digest('hex');

      // Send webhook
      const response = await fetch(plugin.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Installation-Id': installation.id,
        },
        body: JSON.stringify({ event, data }),
      });

      const responseBody = await response.json();

      // Log webhook with retry state if failed
      const { calculateNextRetryTime, shouldRetry } = await import('../utils/webhook-retry');
      const isSuccess = response.ok;
      const nextRetry = !isSuccess && shouldRetry(0) ? calculateNextRetryTime(0) : null;
      
      await storage.createWebhookLog({
        installationId: id,
        direction: 'outgoing',
        eventType: event,
        requestUrl: plugin.webhookUrl,
        requestMethod: 'POST',
        requestHeaders: { 'Content-Type': 'application/json' } as any,
        requestBody: { event, data },
        responseStatus: response.status,
        responseBody,
        status: isSuccess ? 'success' : (nextRetry ? 'pending_retry' : 'failed'),
        errorMessage: isSuccess ? undefined : `HTTP ${response.status}`,
        retryCount: 0,
        nextRetryAt: nextRetry,
        processingTimeMs: Date.now() - startTime,
      });

      res.json({ success: response.ok, response: responseBody });
    } catch (error: any) {
      console.error("Error triggering webhook:", error);
      
      const { calculateNextRetryTime, shouldRetry } = await import('../utils/webhook-retry');
      const nextRetry = shouldRetry(0) ? calculateNextRetryTime(0) : null;
      
      await storage.createWebhookLog({
        installationId: id,
        direction: 'outgoing',
        eventType: req.body?.event || 'unknown',
        requestBody: req.body,
        status: nextRetry ? 'pending_retry' : 'failed',
        errorMessage: error.message,
        retryCount: 0,
        nextRetryAt: nextRetry,
        processingTimeMs: Date.now() - startTime,
      });

      res.status(500).json({ message: error.message });
    }
  });

  // Shelter Onboarding
  app.post('/api/shelter/onboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Verify user has shelter role
      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. User must have shelter role." });
      }

      // Check if shelter profile already exists
      const existing = await storage.getShelterProfile(userId);
      if (existing) {
        return res.status(400).json({ message: "Shelter profile already exists" });
      }

      // Create shelter profile
      const shelterProfile = await storage.createShelterProfile({
        userId,
        shelterName: req.body.shelterName,
        location: req.body.location,
        email: req.body.email,
        phone: req.body.phone,
        licenseNumber: req.body.licenseNumber || null,
        description: req.body.description || null,
        isVerified: false,
      });

      res.json(shelterProfile);
    } catch (error: any) {
      console.error("Shelter onboarding error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current user's shelter profile
  app.get('/api/shelter/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await storage.getShelterProfile(userId);

      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      res.json(shelterProfile);
    } catch (error: any) {
      console.error("Error fetching shelter profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update current user's shelter profile
  app.patch('/api/shelter/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await storage.getShelterProfile(userId);

      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      const updated = await storage.updateShelterProfile(shelterProfile.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating shelter profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER STAFF MANAGEMENT
  // ============================================

  // Get current user's staff permissions
  app.get('/api/shelter/staff/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If the user is a shelter owner, they have full permissions
      if (user.role === 'shelter') {
        return res.json({
          role: "owner",
          canManageDogs: true,
          canManageTasks: true,
          canViewMedical: true,
          canEditMedical: true,
          canManageStaff: true,
          canViewReports: true,
          canManageCalendar: true,
          canManageApplications: true,
          canManageFosters: true,
          canViewBehavior: true,
          canEditBehavior: true,
          canViewInbox: true,
          canSendMessages: true,
        });
      }

      // Find staff record by user ID first
      let staffRecord = null;
      const [byUserId] = await db.select()
        .from(schema.shelterStaff)
        .where(eq(schema.shelterStaff.userId, userId))
        .limit(1);
      
      if (byUserId) {
        staffRecord = byUserId;
      } else if (user.email) {
        // Fall back to looking up by email if userId not linked
        const [byEmail] = await db.select()
          .from(schema.shelterStaff)
          .where(eq(schema.shelterStaff.email, user.email))
          .limit(1);
        staffRecord = byEmail;
      }

      if (!staffRecord) {
        // Return minimal permissions for non-staff users viewing shelter pages
        return res.json({
          role: "viewer",
          canManageDogs: false,
          canManageTasks: false,
          canViewMedical: false,
          canEditMedical: false,
          canManageStaff: false,
          canViewReports: false,
          canManageCalendar: false,
          canManageApplications: false,
          canManageFosters: false,
          canViewBehavior: false,
          canEditBehavior: false,
          canViewInbox: false,
          canSendMessages: false,
        });
      }

      res.json({
        role: staffRecord.role,
        canManageDogs: staffRecord.canManageDogs,
        canManageTasks: staffRecord.canManageTasks,
        canViewMedical: staffRecord.canViewMedical,
        canEditMedical: staffRecord.canEditMedical,
        canManageStaff: staffRecord.canManageStaff,
        canViewReports: staffRecord.canViewReports,
        canManageCalendar: staffRecord.canManageCalendar,
        canManageApplications: staffRecord.canManageApplications,
        canManageFosters: staffRecord.canManageFosters,
        canViewBehavior: staffRecord.canViewBehavior,
        canEditBehavior: staffRecord.canEditBehavior,
        canViewInbox: staffRecord.canViewInbox,
        canSendMessages: staffRecord.canSendMessages,
      });
    } catch (error: any) {
      console.error("Error fetching staff permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all staff members for this shelter
  app.get('/api/shelter/staff', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const staff = await db.select()
        .from(schema.shelterStaff)
        .where(eq(schema.shelterStaff.shelterId, userId))
        .orderBy(schema.shelterStaff.createdAt);

      res.json(staff);
    } catch (error: any) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get available staff roles
  app.get('/api/shelter/staff/roles', isAuthenticated, async (req: any, res) => {
    try {
      res.json(schema.SHELTER_STAFF_ROLES);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add a new staff member
  app.post('/api/shelter/staff', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { name, email, phone, role, customTitle } = req.body;

      if (!name || !role) {
        return res.status(400).json({ message: "Name and role are required" });
      }

      // Get default permissions for the role
      const roleConfig = schema.SHELTER_STAFF_ROLES[role as schema.ShelterStaffRole];
      if (!roleConfig) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const [newStaff] = await db.insert(schema.shelterStaff)
        .values({
          shelterId: userId,
          name,
          email: email || null,
          phone: phone || null,
          role,
          customTitle: customTitle || null,
          invitedBy: userId,
          invitedAt: new Date(),
          ...roleConfig.defaultPermissions,
        })
        .returning();

      res.status(201).json(newStaff);
    } catch (error: any) {
      console.error("Error creating staff member:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a staff member
  app.patch('/api/shelter/staff/:staffId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { staffId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify this staff member belongs to this shelter
      const [existingStaff] = await db.select()
        .from(schema.shelterStaff)
        .where(and(
          eq(schema.shelterStaff.id, staffId),
          eq(schema.shelterStaff.shelterId, userId)
        ));

      if (!existingStaff) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      // If role is being changed, apply new default permissions
      let updates = { ...req.body, updatedAt: new Date() };
      if (req.body.role && req.body.role !== existingStaff.role) {
        const roleConfig = schema.SHELTER_STAFF_ROLES[req.body.role as schema.ShelterStaffRole];
        if (roleConfig) {
          updates = { ...updates, ...roleConfig.defaultPermissions };
        }
      }

      const [updatedStaff] = await db.update(schema.shelterStaff)
        .set(updates)
        .where(eq(schema.shelterStaff.id, staffId))
        .returning();

      res.json(updatedStaff);
    } catch (error: any) {
      console.error("Error updating staff member:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a staff member
  app.delete('/api/shelter/staff/:staffId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { staffId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify this staff member belongs to this shelter
      const [existingStaff] = await db.select()
        .from(schema.shelterStaff)
        .where(and(
          eq(schema.shelterStaff.id, staffId),
          eq(schema.shelterStaff.shelterId, userId)
        ));

      if (!existingStaff) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      await db.delete(schema.shelterStaff)
        .where(eq(schema.shelterStaff.id, staffId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a staff invitation
  app.post('/api/shelter/staff/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { email, role, customTitle } = req.body;

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      const roleConfig = schema.SHELTER_STAFF_ROLES[role as schema.ShelterStaffRole];
      if (!roleConfig) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Check for existing pending invitation
      const [existing] = await db.select()
        .from(schema.shelterStaffInvitations)
        .where(and(
          eq(schema.shelterStaffInvitations.shelterId, userId),
          eq(schema.shelterStaffInvitations.email, email),
          eq(schema.shelterStaffInvitations.status, 'pending')
        ));

      if (existing) {
        return res.status(400).json({ message: "An invitation for this email is already pending" });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invitation] = await db.insert(schema.shelterStaffInvitations)
        .values({
          shelterId: userId,
          email,
          role,
          customTitle: customTitle || null,
          invitedBy: userId,
          token,
          expiresAt,
        })
        .returning();

      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending invitations
  app.get('/api/shelter/staff/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const invitations = await db.select()
        .from(schema.shelterStaffInvitations)
        .where(and(
          eq(schema.shelterStaffInvitations.shelterId, userId),
          eq(schema.shelterStaffInvitations.status, 'pending')
        ))
        .orderBy(desc(schema.shelterStaffInvitations.invitedAt));

      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Revoke an invitation
  app.delete('/api/shelter/staff/invitations/:invitationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { invitationId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [updated] = await db.update(schema.shelterStaffInvitations)
        .set({ status: 'revoked' })
        .where(and(
          eq(schema.shelterStaffInvitations.id, invitationId),
          eq(schema.shelterStaffInvitations.shelterId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get shelter's dogs (authenticated - for shelter dashboard)
  app.get('/api/shelter/dogs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Shelter Dogs] Fetching for user:", userId);

      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        console.log("[Shelter Dogs] Access denied - role:", user?.role);
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get shelter profile to get shelter ID
      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        console.log("[Shelter Dogs] Shelter profile not found");
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Get all dogs belonging to this shelter
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId))
        .orderBy(desc(schema.dogs.createdAt));

      console.log("[Shelter Dogs] Found", dogs.length, "dogs");

      // Get intake records for these dogs
      const dogIds = dogs.map(d => d.id);
      let intakeRecords: any[] = [];
      if (dogIds.length > 0) {
        intakeRecords = await db.select()
          .from(schema.intakeRecords)
          .where(sql`${schema.intakeRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }

      console.log("[Shelter Dogs] Found", intakeRecords.length, "intake records");

      // Map intake records to dogs
      const intakeMap = new Map(intakeRecords.map(ir => [ir.dogId, ir]));
      const dogsWithIntake = dogs.map(dog => ({
        ...dog,
        intake: intakeMap.get(dog.id) || null,
      }));

      // Set cache headers to prevent stale data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json(dogsWithIntake);
    } catch (error: any) {
      console.error("Error fetching shelter dogs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Shelter Dashboard Metrics
  app.get('/api/shelter/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Get dogs for this shelter
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = dogs.map(d => d.id);

      // Get intake records for pipeline status
      let intakeRecords: any[] = [];
      if (dogIds.length > 0) {
        intakeRecords = await db.select()
          .from(schema.intakeRecords)
          .where(sql`${schema.intakeRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }

      const intakeMap = new Map(intakeRecords.map(ir => [ir.dogId, ir]));

      // Count by pipeline status
      let dogsInIntake = 0;
      let dogsInMedicalHold = 0;
      let dogsReady = 0;

      dogs.forEach(dog => {
        const intake = intakeMap.get(dog.id);
        const status = intake?.pipelineStatus || 'ready';
        if (status === 'intake' || status === 'stray_hold') dogsInIntake++;
        else if (status === 'medical_hold') dogsInMedicalHold++;
        else if (status === 'ready' || status === 'featured') dogsReady++;
      });

      // Get tasks for this shelter (tasks use userId as shelterId)
      const tasks = await db.select()
        .from(schema.shelterTasks)
        .where(eq(schema.shelterTasks.shelterId, userId));

      const now = new Date();
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
      const overdueTasks = tasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
      ).length;

      // Get upcoming vaccines (medical records of type vaccine with next due date)
      let upcomingVaccines = 0;
      if (dogIds.length > 0) {
        const vaccineRecords = await db.select()
          .from(schema.medicalRecords)
          .where(sql`${schema.medicalRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)}) AND ${schema.medicalRecords.recordType} = 'vaccine'`);

        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);

        upcomingVaccines = vaccineRecords.filter(v => 
          v.nextDueDate && new Date(v.nextDueDate) <= weekFromNow
        ).length;
      }

      // Get active applications (using adoption journeys)
      let activeApplications = 0;
      if (dogIds.length > 0) {
        const journeys = await db.select()
          .from(schema.adoptionJourneys)
          .where(sql`${schema.adoptionJourneys.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)}) AND ${schema.adoptionJourneys.currentStep} IN ('application', 'phone_screening', 'meet_greet')`);
        activeApplications = journeys.length;
      }

      const metrics = {
        totalDogs: dogs.length,
        dogsInIntake,
        dogsReady,
        dogsInMedicalHold,
        pendingTasks,
        overdueTasks,
        upcomingVaccines,
        activeApplications,
      };

      res.json(metrics);
    } catch (error: any) {
      console.error("Error fetching shelter dashboard:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Shelter Tasks
  app.get('/api/shelter/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Query by userId since tasks were created with userId as shelterId
      // Optionally filter by dogId if provided
      const whereConditions = dogId 
        ? and(eq(schema.shelterTasks.shelterId, userId), eq(schema.shelterTasks.dogId, dogId as string))
        : eq(schema.shelterTasks.shelterId, userId);
        
      const tasks = await db.select()
        .from(schema.shelterTasks)
        .where(whereConditions)
        .orderBy(schema.shelterTasks.dueDate);

      // Get dog info for tasks with dogId
      const dogIds = tasks.filter(t => t.dogId).map(t => t.dogId as string);
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(sql`${schema.dogs.id} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }

      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const tasksWithDogs = tasks.map(task => ({
        ...task,
        dog: task.dogId ? dogMap.get(task.dogId) || null : null,
      }));

      res.json(tasksWithDogs);
    } catch (error: any) {
      console.error("Error fetching shelter tasks:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update shelter task
  app.patch('/api/shelter/tasks/:taskId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { taskId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Verify task belongs to this shelter
      const [task] = await db.select()
        .from(schema.shelterTasks)
        .where(eq(schema.shelterTasks.id, taskId));

      if (!task || task.shelterId !== userId) {
        return res.status(404).json({ message: "Task not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.completedAt !== undefined) {
        updateData.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : null;
      }
      if (req.body.dueDate !== undefined) {
        updateData.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
      }
      if (req.body.dueTime !== undefined) updateData.dueTime = req.body.dueTime;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.assignedTo !== undefined) updateData.assignedTo = req.body.assignedTo;
      if (req.body.parentTaskId !== undefined) updateData.parentTaskId = req.body.parentTaskId;
      if (req.body.sortOrder !== undefined) updateData.sortOrder = req.body.sortOrder;

      const [updatedTask] = await db.update(schema.shelterTasks)
        .set(updateData)
        .where(eq(schema.shelterTasks.id, taskId))
        .returning();

      res.json(updatedTask);
    } catch (error: any) {
      console.error("Error updating shelter task:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create shelter task
  app.post('/api/shelter/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      const { title, description, category, taskType, priority, dueDate, dueTime, dogId, assignedTo, parentTaskId, sortOrder } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Task title is required" });
      }

      const [newTask] = await db.insert(schema.shelterTasks)
        .values({
          id: crypto.randomUUID(),
          shelterId: userId,
          title,
          description: description || null,
          taskType: taskType || category || 'custom',  // Accept both taskType and category for backwards compatibility
          priority: priority || 'medium',
          dueDate: dueDate ? new Date(dueDate) : null,
          dueTime: dueTime || null,
          dogId: dogId || null,
          assignedTo: assignedTo || null,
          parentTaskId: parentTaskId || null,
          sortOrder: sortOrder ?? 0,
          status: 'pending',
          createdAt: new Date(),
        })
        .returning();

      res.json(newTask);
    } catch (error: any) {
      console.error("Error creating shelter task:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete shelter task
  app.delete('/api/shelter/tasks/:taskId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { taskId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify task belongs to this shelter
      const [task] = await db.select()
        .from(schema.shelterTasks)
        .where(eq(schema.shelterTasks.id, taskId));

      if (!task || task.shelterId !== userId) {
        return res.status(404).json({ message: "Task not found" });
      }

      await db.delete(schema.shelterTasks)
        .where(eq(schema.shelterTasks.id, taskId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting shelter task:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder shelter tasks (Google Tasks-style drag and drop)
  app.post('/api/shelter/tasks/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { orderedIds, parentTaskId } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ message: "orderedIds must be a non-empty array" });
      }

      // First verify all tasks belong to this shelter and have matching parentTaskId
      const tasksToReorder = await db.select()
        .from(schema.shelterTasks)
        .where(and(
          eq(schema.shelterTasks.shelterId, userId),
          parentTaskId 
            ? eq(schema.shelterTasks.parentTaskId, parentTaskId)
            : isNull(schema.shelterTasks.parentTaskId)
        ));

      const validTaskIds = new Set(tasksToReorder.map(t => t.id));
      const invalidIds = orderedIds.filter((id: string) => !validTaskIds.has(id));
      
      if (invalidIds.length > 0) {
        return res.status(400).json({ 
          message: "Some task IDs are invalid or don't belong to your shelter",
          invalidIds 
        });
      }

      // Update sort order for each task atomically
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(schema.shelterTasks)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(
            eq(schema.shelterTasks.id, orderedIds[i]),
            eq(schema.shelterTasks.shelterId, userId)
          ));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering tasks:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get medical records for a specific dog
  app.get('/api/shelter/medical/dog/:dogId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const records = await db.select()
        .from(schema.medicalRecords)
        .where(eq(schema.medicalRecords.dogId, dogId))
        .orderBy(desc(schema.medicalRecords.performedAt));

      res.json(records);
    } catch (error: any) {
      console.error("Error fetching medical records:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get vaccines for a dog
  app.get('/api/shelter/medical/dog/:dogId/vaccines', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Get vaccine records (medical records of type vaccine)
      const records = await db.select()
        .from(schema.medicalRecords)
        .where(and(
          eq(schema.medicalRecords.dogId, dogId),
          eq(schema.medicalRecords.recordType, 'vaccine')
        ))
        .orderBy(desc(schema.medicalRecords.performedAt));

      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vaccines:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create medical record
  app.post('/api/shelter/medical', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { dogId, recordType, description, recordDate, veterinarian, notes, nextDueDate, cost } = req.body;

      if (!dogId || !recordType) {
        return res.status(400).json({ message: "Dog ID and record type are required" });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const [newRecord] = await db.insert(schema.medicalRecords)
        .values({
          id: crypto.randomUUID(),
          dogId,
          shelterId: userId,
          recordType,
          title: description || recordType,
          description: description || null,
          performedAt: recordDate ? new Date(recordDate) : new Date(),
          veterinarian: veterinarian || null,
          nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
          cost: cost || null,
        })
        .returning();

      // Auto-complete related pending tasks when medical record is added
      if (recordType === 'vaccine') {
        // Find and complete pending vaccine tasks for this dog
        const pendingVaccineTasks = await db.select()
          .from(schema.shelterTasks)
          .where(and(
            eq(schema.shelterTasks.dogId, dogId),
            eq(schema.shelterTasks.shelterId, userId),
            eq(schema.shelterTasks.taskType, 'vaccine'),
            eq(schema.shelterTasks.status, 'pending')
          ));
        
        for (const task of pendingVaccineTasks) {
          // Check if task title matches the vaccine type (flexible matching)
          const taskLower = task.title.toLowerCase();
          const descLower = (description || '').toLowerCase();
          if (taskLower.includes(descLower) || descLower.includes(taskLower) || taskLower.includes('vaccine')) {
            await db.update(schema.shelterTasks)
              .set({
                status: 'completed',
                completedAt: new Date(),
                completedBy: userId,
                completionNotes: `Auto-completed: ${recordType} record added`,
                updatedAt: new Date(),
              })
              .where(eq(schema.shelterTasks.id, task.id));
            
            // Log automation run for explainability
            await db.insert(schema.automationRuns).values({
              shelterId: userId,
              triggerType: 'vaccine_added',
              triggerEvent: `Vaccine record "${description || recordType}" was added for ${dog.name}`,
              targetType: 'task',
              targetId: task.id,
              dogId: dogId,
              actionType: 'auto_complete_task',
              actionDescription: `Completed task "${task.title}" for ${dog.name}`,
              result: 'success',
            });
          }
        }
      } else if (['treatment', 'exam', 'surgery', 'medication'].includes(recordType)) {
        // Auto-complete matching medical tasks
        const pendingMedicalTasks = await db.select()
          .from(schema.shelterTasks)
          .where(and(
            eq(schema.shelterTasks.dogId, dogId),
            eq(schema.shelterTasks.shelterId, userId),
            eq(schema.shelterTasks.taskType, 'medical'),
            eq(schema.shelterTasks.status, 'pending')
          ));
        
        for (const task of pendingMedicalTasks) {
          await db.update(schema.shelterTasks)
            .set({
              status: 'completed',
              completedAt: new Date(),
              completedBy: userId,
              completionNotes: `Auto-completed: ${recordType} record added`,
              updatedAt: new Date(),
            })
            .where(eq(schema.shelterTasks.id, task.id));
          
          // Log automation run for explainability
          await db.insert(schema.automationRuns).values({
            shelterId: userId,
            triggerType: 'medical_added',
            triggerEvent: `Medical record "${description || recordType}" was added for ${dog.name}`,
            targetType: 'task',
            targetId: task.id,
            dogId: dogId,
            actionType: 'auto_complete_task',
            actionDescription: `Completed task "${task.title}" for ${dog.name}`,
            result: 'success',
          });
        }
      }

      res.json(newRecord);
    } catch (error: any) {
      console.error("Error creating medical record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete medical record
  app.delete('/api/shelter/medical/:recordId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { recordId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify record belongs to this shelter
      const [record] = await db.select()
        .from(schema.medicalRecords)
        .where(eq(schema.medicalRecords.id, recordId));

      if (!record || record.shelterId !== userId) {
        return res.status(404).json({ message: "Medical record not found" });
      }

      await db.delete(schema.medicalRecords)
        .where(eq(schema.medicalRecords.id, recordId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting medical record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete shelter dog
  app.delete('/api/shelter/dogs/:dogId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Delete associated intake records first
      await db.delete(schema.intakeRecords)
        .where(eq(schema.intakeRecords.dogId, dogId));

      // Delete associated medical records
      await db.delete(schema.medicalRecords)
        .where(eq(schema.medicalRecords.dogId, dogId));

      // Delete associated tasks
      await db.delete(schema.shelterTasks)
        .where(eq(schema.shelterTasks.dogId, dogId));

      // Delete the dog
      await db.delete(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting shelter dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get treatment plans for a specific dog
  app.get('/api/shelter/dogs/:dogId/treatment-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const plans = await db.select()
        .from(schema.treatmentPlans)
        .where(eq(schema.treatmentPlans.dogId, dogId))
        .orderBy(desc(schema.treatmentPlans.createdAt));

      res.json(plans);
    } catch (error: any) {
      console.error("Error fetching treatment plans for dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get vet referrals for a specific dog
  app.get('/api/shelter/dogs/:dogId/vet-referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const referrals = await db.select()
        .from(schema.vetReferrals)
        .where(eq(schema.vetReferrals.dogId, dogId))
        .orderBy(desc(schema.vetReferrals.createdAt));

      res.json(referrals);
    } catch (error: any) {
      console.error("Error fetching vet referrals for dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get dog events (timeline) for a specific dog
  app.get('/api/shelter/dogs/:dogId/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const { limit: limitStr, eventType } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const limit = limitStr ? parseInt(limitStr as string) : 50;

      // Build query conditions
      let conditions = [eq(schema.dogEvents.dogId, dogId)];
      if (eventType) {
        conditions.push(eq(schema.dogEvents.eventType, eventType as string));
      }

      const events = await db.select()
        .from(schema.dogEvents)
        .where(and(...conditions))
        .orderBy(desc(schema.dogEvents.createdAt))
        .limit(limit);

      res.json(events);
    } catch (error: any) {
      console.error("Error fetching dog events:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get intake records for shelter
  app.get('/api/shelter/intake', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get all dogs for this shelter with their intake records
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = dogs.map(d => d.id);

      if (dogIds.length === 0) {
        return res.json([]);
      }

      const intakeRecords = await db.select()
        .from(schema.intakeRecords)
        .where(inArray(schema.intakeRecords.dogId, dogIds));

      // Attach dog info to each intake record
      const dogMap = new Map(dogs.map(d => [d.id, d]));
      const recordsWithDogs = intakeRecords.map(record => ({
        ...record,
        dog: dogMap.get(record.dogId) || null,
      }));

      res.json(recordsWithDogs);
    } catch (error: any) {
      console.error("Error fetching intake records:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single intake record by ID
  app.get('/api/shelter/intake/:intakeId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { intakeId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [record] = await db.select()
        .from(schema.intakeRecords)
        .where(eq(schema.intakeRecords.id, intakeId));

      if (!record) {
        return res.status(404).json({ message: "Intake record not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, record.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json({ ...record, dog });
    } catch (error: any) {
      console.error("Error fetching intake record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // AUTOMATION RUNS (Explainability Logs)
  // ============================================
  
  // Get automation runs for shelter
  app.get('/api/shelter/automation-runs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId, limit: limitStr } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const limit = limitStr ? parseInt(limitStr) : 50;
      
      // Build query conditions
      const conditions = [eq(schema.automationRuns.shelterId, userId)];
      if (dogId) {
        conditions.push(eq(schema.automationRuns.dogId, dogId as string));
      }

      const runs = await db.select()
        .from(schema.automationRuns)
        .where(and(...conditions))
        .orderBy(desc(schema.automationRuns.createdAt))
        .limit(limit);

      // Enrich with dog info
      const dogIds = [...new Set(runs.filter(r => r.dogId).map(r => r.dogId as string))];
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(inArray(schema.dogs.id, dogIds));
      }
      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const enrichedRuns = runs.map(run => ({
        ...run,
        dog: run.dogId ? dogMap.get(run.dogId) || null : null,
      }));

      res.json(enrichedRuns);
    } catch (error: any) {
      console.error("Error fetching automation runs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER RESOURCES ENDPOINTS
  // ============================================

  // Get all resources for a shelter
  app.get('/api/shelter/resources', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const resources = await db.select()
        .from(schema.shelterResources)
        .where(eq(schema.shelterResources.shelterId, userId))
        .orderBy(desc(schema.shelterResources.createdAt));

      res.json(resources);
    } catch (error: any) {
      console.error("Error fetching shelter resources:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new resource
  app.post('/api/shelter/resources', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { resourceType, title, description, availability, schedule, eligibilityNotes, cost, contactPhone, contactEmail, websiteUrl, isActive } = req.body;

      if (!resourceType || !title) {
        return res.status(400).json({ message: "Resource type and title are required" });
      }

      const [newResource] = await db.insert(schema.shelterResources)
        .values({
          id: crypto.randomUUID(),
          shelterId: userId,
          resourceType,
          title,
          description: description || null,
          availability: availability || null,
          schedule: schedule || null,
          eligibilityNotes: eligibilityNotes || null,
          cost: cost || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          websiteUrl: websiteUrl || null,
          isActive: isActive !== undefined ? isActive : true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(newResource);
    } catch (error: any) {
      console.error("Error creating shelter resource:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a resource
  app.patch('/api/shelter/resources/:resourceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { resourceId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify resource belongs to this shelter
      const [resource] = await db.select()
        .from(schema.shelterResources)
        .where(eq(schema.shelterResources.id, resourceId));

      if (!resource || resource.shelterId !== userId) {
        return res.status(404).json({ message: "Resource not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      const allowedFields = ['resourceType', 'title', 'description', 'availability', 'schedule', 'eligibilityNotes', 'cost', 'contactPhone', 'contactEmail', 'websiteUrl', 'isActive'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const [updatedResource] = await db.update(schema.shelterResources)
        .set(updateData)
        .where(eq(schema.shelterResources.id, resourceId))
        .returning();

      res.json(updatedResource);
    } catch (error: any) {
      console.error("Error updating shelter resource:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a resource
  app.delete('/api/shelter/resources/:resourceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { resourceId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify resource belongs to this shelter
      const [resource] = await db.select()
        .from(schema.shelterResources)
        .where(eq(schema.shelterResources.id, resourceId));

      if (!resource || resource.shelterId !== userId) {
        return res.status(404).json({ message: "Resource not found" });
      }

      await db.delete(schema.shelterResources)
        .where(eq(schema.shelterResources.id, resourceId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting shelter resource:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER APPLICATION QUESTIONS ROUTES
  // ============================================

  // Get shelter application form and questions (including admin questions for reference)
  app.get('/api/shelter/application-questions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Check if shelter_application_builder feature is enabled
      const enabledFlags = await storage.getEnabledFeatureFlags();
      const isApplicationBuilderEnabled = enabledFlags.some(f => f.key === 'shelter_application_builder');

      // Get or create the shelter's application form
      let form = await storage.getShelterApplicationForm(userId);
      
      if (!form) {
        // Create a default form for this shelter
        form = await storage.createShelterApplicationForm({
          shelterId: userId,
          title: "Adoption Application",
          isDefault: true,
        });
      }

      // Get shelter's custom questions
      const shelterQuestions = await storage.getShelterApplicationQuestions(form.id);
      
      // Only return admin questions if application builder feature is enabled
      let adminQuestionsResponse: any[] = [];
      if (isApplicationBuilderEnabled) {
        const adminQuestions = await storage.getApplicationQuestions();
        const activeAdminQuestions = adminQuestions.filter(q => q.isActive);
        adminQuestionsResponse = activeAdminQuestions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          helperText: q.helperText,
          options: q.options,
          isRequired: q.isRequired,
          position: q.position,
          mode: q.mode,
          section: q.section,
          source: 'platform' as const,
        }));
      }

      res.json({ 
        form, 
        questions: shelterQuestions,
        adminQuestions: adminQuestionsResponse,
      });
    } catch (error: any) {
      console.error("Error fetching shelter application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new question
  app.post('/api/shelter/application-questions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get or create the shelter's application form
      let form = await storage.getShelterApplicationForm(userId);
      
      if (!form) {
        form = await storage.createShelterApplicationForm({
          shelterId: userId,
          title: "Adoption Application",
          isDefault: true,
        });
      }

      // Get existing questions to determine position
      const existingQuestions = await storage.getShelterApplicationQuestions(form.id);
      const nextPosition = existingQuestions.length;

      const question = await storage.createShelterApplicationQuestion({
        formId: form.id,
        shelterId: userId,
        questionText: req.body.questionText,
        questionType: req.body.questionType || 'text',
        helperText: req.body.helperText || null,
        options: req.body.options || null,
        isRequired: req.body.isRequired ?? false,
        position: nextPosition,
        isActive: true,
      });

      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating shelter application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a question
  app.patch('/api/shelter/application-questions/:questionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { questionId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify question belongs to this shelter
      const question = await storage.getShelterApplicationQuestion(questionId);
      if (!question || question.shelterId !== userId) {
        return res.status(404).json({ message: "Question not found" });
      }

      const updated = await storage.updateShelterApplicationQuestion(questionId, {
        questionText: req.body.questionText,
        questionType: req.body.questionType,
        helperText: req.body.helperText,
        options: req.body.options,
        isRequired: req.body.isRequired,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating shelter application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a question
  app.delete('/api/shelter/application-questions/:questionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { questionId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify question belongs to this shelter
      const question = await storage.getShelterApplicationQuestion(questionId);
      if (!question || question.shelterId !== userId) {
        return res.status(404).json({ message: "Question not found" });
      }

      await storage.deleteShelterApplicationQuestion(questionId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting shelter application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder questions
  app.patch('/api/shelter/application-questions/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const form = await storage.getShelterApplicationForm(userId);
      if (!form) {
        return res.status(404).json({ message: "No application form found" });
      }

      const { questionIds } = req.body;
      if (!Array.isArray(questionIds)) {
        return res.status(400).json({ message: "questionIds must be an array" });
      }

      await storage.reorderShelterApplicationQuestions(form.id, questionIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering shelter application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER APPLICANT APPROVAL ROUTES (VAPI Phone Screening)
  // ============================================

  // Get all applications for this shelter's animals
  app.get('/api/shelter/applicants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const status = req.query.status as string | undefined;
      const applications = await storage.getShelterApplications(userId, status);

      // Enrich with user and dog info
      const enrichedApplications = await Promise.all(applications.map(async (app) => {
        const applicant = await storage.getUser(app.userId);
        const applicantProfile = await storage.getUserProfile(app.userId);
        const dog = await storage.getDog(app.dogId);
        
        return {
          ...app,
          applicant: applicant ? {
            id: applicant.id,
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            email: applicant.email,
            phone: applicantProfile?.phone,
            profileImageUrl: applicant.profileImageUrl,
          } : null,
          dog: dog ? {
            id: dog.id,
            name: dog.name,
            breed: dog.breed,
            imageUrl: dog.imageUrl,
          } : null,
        };
      }));

      res.json(enrichedApplications);
    } catch (error: any) {
      console.error("Error fetching shelter applications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get a single application with full details
  app.get('/api/shelter/applicants/:applicationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const application = await storage.getShelterApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify application is for this shelter's dog
      const dog = await storage.getDog(application.dogId);
      if (!dog || dog.shelterId !== userId) {
        return res.status(403).json({ message: "Application not found for this shelter" });
      }

      const applicant = await storage.getUser(application.userId);
      const applicantProfile = await storage.getUserProfile(application.userId);

      res.json({
        ...application,
        applicant: applicant ? {
          id: applicant.id,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          phone: applicantProfile?.phone,
          profileImageUrl: applicant.profileImageUrl,
        } : null,
        dog: dog ? {
          id: dog.id,
          name: dog.name,
          breed: dog.breed,
          imageUrl: dog.imageUrl,
          age: dog.age,
          gender: dog.gender,
        } : null,
      });
    } catch (error: any) {
      console.error("Error fetching shelter application:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve or reject an application
  app.post('/api/shelter/applicants/:applicationId/decision', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { status, notes, reason } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      if (!status || !['approved', 'rejected', 'more_info_needed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'approved', 'rejected', or 'more_info_needed'" });
      }

      const application = await storage.getShelterApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify application is for this shelter's dog
      const dog = await storage.getDog(application.dogId);
      if (!dog || dog.shelterId !== userId) {
        return res.status(403).json({ message: "Application not found for this shelter" });
      }

      const updated = await storage.updateShelterApplicationStatus(applicationId, status, userId, notes, reason);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Upcoming vaccines for shelter
  app.get('/api/shelter/medical/vaccines/upcoming', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get dogs for this shelter
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = dogs.map(d => d.id);
      const dogMap = new Map(dogs.map(d => [d.id, d.name]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // Get vaccine records with upcoming due dates
      const vaccineRecords = await db.select()
        .from(schema.medicalRecords)
        .where(sql`${schema.medicalRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)}) AND ${schema.medicalRecords.recordType} = 'vaccine' AND ${schema.medicalRecords.nextDueDate} IS NOT NULL`)
        .orderBy(schema.medicalRecords.nextDueDate);

      const upcomingVaccines = vaccineRecords.map(v => ({
        id: v.id,
        dogId: v.dogId,
        dogName: dogMap.get(v.dogId) || 'Unknown',
        vaccineName: v.description || 'Vaccine',
        nextDueDate: v.nextDueDate,
      }));

      res.json(upcomingVaccines);
    } catch (error: any) {
      console.error("Error fetching upcoming vaccines:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // AI HEALTH SCREENING ENDPOINTS
  // ============================================

  // AI Health Screening - Analyze symptoms and/or images for health assessment
  app.post('/api/shelter/health-screening', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Check feature flag
      const healthScreeningFlag = await storage.getFeatureFlag('ai_health_screening');
      if (!healthScreeningFlag || !healthScreeningFlag.isEnabled) {
        return res.status(403).json({ message: "AI Health Screening feature is disabled" });
      }

      // Check plugin is enabled
      if (!isPluginEnabled()) {
        return res.status(503).json({ message: "Health screening plugin is not available" });
      }

      const { dogId, symptoms, images, screeningType, petIdentification } = req.body;

      if (!screeningType || !['symptom_check', 'image_analysis', 'full_assessment'].includes(screeningType)) {
        return res.status(400).json({ message: "Invalid screening type. Must be 'symptom_check', 'image_analysis', or 'full_assessment'" });
      }

      if (screeningType === 'symptom_check' && !symptoms) {
        return res.status(400).json({ message: "Symptoms are required for symptom check" });
      }

      if (screeningType === 'image_analysis' && (!images || images.length === 0)) {
        return res.status(400).json({ message: "At least one image is required for image analysis" });
      }

      if (screeningType === 'full_assessment' && !symptoms && (!images || images.length === 0)) {
        return res.status(400).json({ message: "Symptoms and/or images are required for full assessment" });
      }

      // Get dog info for context
      let dogContext = "";
      if (dogId) {
        const dog = await storage.getDog(dogId);
        if (dog) {
          dogContext = `
Dog Information:
- Name: ${dog.name}
- Breed: ${dog.breed}
- Age: ${dog.age} years
- Size: ${dog.size}
- Gender: ${dog.gender}
- Known conditions: ${dog.healthConditions?.join(', ') || 'None listed'}`;
        }
      }

      console.log(`[Health Screening] Running ${screeningType} analysis for dog ${dogId || 'unknown'}`);

      // Use plugin for AI analysis
      const result = await emitAnalyzeRequest({
        dogId: dogId || null,
        userId,
        screeningType,
        symptoms,
        images,
        dogContext,
        petIdentification,
      });

      // Save screening result to database
      const screeningResult = await storage.createHealthScreening({
        dogId: dogId || null,
        shelterId: userId,
        symptoms: symptoms || null,
        imageUrls: images ? images.map((_: string, i: number) => `image_${i + 1}`) : null,
        screeningType,
        severity: result.severity,
        recommendation: result.recommendation,
        aiAnalysis: result.analysis,
        conditions: result.conditions || null,
        careInstructions: result.careInstructions || null,
      });

      res.json({
        id: screeningResult.id,
        severity: result.severity,
        recommendation: result.recommendation,
        conditions: result.conditions || [],
        analysis: result.analysis,
        careInstructions: result.careInstructions,
        disclaimer: "This is an AI-powered preliminary screening. Always consult a licensed veterinarian for diagnosis and treatment.",
      });
    } catch (error: any) {
      console.error("[Health Screening] Error:", error);
      res.status(500).json({ message: "Failed to complete health screening", error: error.message });
    }
  });

  // Get health screening results for a shelter
  app.get('/api/shelter/health-screenings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { unreviewedOnly } = req.query;
      
      let results;
      if (unreviewedOnly === 'true') {
        results = await storage.getUnreviewedHealthScreenings(userId);
      } else {
        results = await storage.getHealthScreeningsByShelter(userId);
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching health screenings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get health screening results for a specific dog
  app.get('/api/shelter/health-screenings/dog/:dogId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { dogId } = req.params;
      const results = await storage.getHealthScreeningsByDog(dogId);

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching dog health screenings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Review a health screening result
  app.post('/api/shelter/health-screenings/:id/review', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const { reviewNotes, createMedicalRecord, medicalRecordData } = req.body;

      let medicalRecordId: string | undefined;

      // Optionally create a medical record from the screening
      if (createMedicalRecord && medicalRecordData) {
        const screening = await storage.getHealthScreening(id);
        if (screening && screening.dogId) {
          const medicalRecord = await storage.createMedicalRecord({
            dogId: screening.dogId,
            recordType: 'exam',
            title: 'AI Health Screening Follow-up',
            description: `AI Screening Results: ${screening.aiAnalysis}\n\nReview Notes: ${reviewNotes}`,
            veterinarian: medicalRecordData.veterinarian || null,
            performedAt: new Date(),
            ...medicalRecordData,
          });
          medicalRecordId = medicalRecord.id;
        }
      }

      const result = await storage.reviewHealthScreening(id, userId, reviewNotes, medicalRecordId);
      
      if (!result) {
        return res.status(404).json({ message: "Health screening not found" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error reviewing health screening:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Health Screening for Intake - Analyze photos during dog intake process
  app.post('/api/shelter/intake-health-screening', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Health Screening] Request from user:", userId);
      
      const user = await storage.getUser(userId);
      console.log("[Health Screening] User found:", user?.id, "Role:", user?.role);

      if (!user || user.role !== 'shelter') {
        console.log("[Health Screening] REJECTED: Not shelter role");
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify shelter profile exists and is approved
      const shelterProfile = await storage.getShelterProfile(userId);
      console.log("[Health Screening] Shelter profile:", shelterProfile?.id, "Status:", shelterProfile?.approvalStatus);
      
      if (!shelterProfile) {
        console.log("[Health Screening] REJECTED: No shelter profile");
        return res.status(404).json({ message: "Shelter profile not found. Please complete shelter registration." });
      }
      
      // Ensure shelter is approved before allowing AI features
      if (shelterProfile.approvalStatus !== 'approved') {
        console.log("[Health Screening] REJECTED: Shelter not approved, status:", shelterProfile.approvalStatus);
        return res.status(403).json({ message: "Shelter must be approved to use AI health screening features." });
      }

      // Check feature flag
      const healthScreeningFlag = await storage.getFeatureFlag('ai_health_screening');
      console.log("[Health Screening] Feature flag:", healthScreeningFlag?.isEnabled);
      
      if (!healthScreeningFlag || !healthScreeningFlag.isEnabled) {
        console.log("[Health Screening] REJECTED: Feature disabled");
        return res.status(403).json({ message: "AI Health Screening feature is disabled" });
      }

      const { dogId, intakeRecordId, photos, concerns } = req.body;

      if (!dogId) {
        return res.status(400).json({ message: "Dog ID is required" });
      }

      // Support both old photos object format and new concerns array format
      const capturedBodyParts: string[] = [];
      const photoEntries: { area: string; image: string; description?: string }[] = [];
      
      // New flexible concerns array format
      if (concerns && Array.isArray(concerns) && concerns.length > 0) {
        for (const concern of concerns) {
          if (concern.photo && concern.bodyArea) {
            capturedBodyParts.push(concern.bodyArea);
            photoEntries.push({ 
              area: concern.bodyArea, 
              image: concern.photo,
              description: concern.description || undefined
            });
          }
        }
      }
      // Legacy fixed photos object format (backward compatibility)
      else if (photos && typeof photos === 'object') {
        for (const [area, imageData] of Object.entries(photos)) {
          if (imageData && typeof imageData === 'string' && imageData.startsWith('data:')) {
            capturedBodyParts.push(area);
            photoEntries.push({ area, image: imageData as string });
          }
        }
      }

      if (capturedBodyParts.length === 0) {
        return res.status(400).json({ message: "At least one photo or concern is required" });
      }

      // Get dog info for context and verify ownership
      const dog = await storage.getDog(dogId);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }
      
      // Verify the dog belongs to this shelter via shelterId
      if (dog.shelterId !== shelterProfile.id) {
        return res.status(403).json({ message: "Access denied. This pet does not belong to your shelter." });
      }

      // Validate intake record belongs to this dog and shelter if provided
      if (intakeRecordId) {
        const [intakeRecord] = await db.select()
          .from(schema.intakeRecords)
          .where(eq(schema.intakeRecords.id, intakeRecordId));
        // Check shelterId matches either shelter profile ID or user ID for compatibility
        if (!intakeRecord || intakeRecord.dogId !== dogId || 
            (intakeRecord.shelterId !== shelterProfile.id && intakeRecord.shelterId !== userId)) {
          return res.status(400).json({ message: "Invalid intake record. The intake record must belong to this pet and shelter." });
        }
      }

      const dogContext = `
Dog Information:
- Name: ${dog.name}
- Breed: ${dog.breed}
- Age: ${dog.age} years
- Size: ${dog.size}
- Known conditions: ${dog.specialNeeds || 'None listed'}`;

      if (!isPluginEnabled()) {
        return res.status(503).json({ message: "Health screening plugin is not available" });
      }

      console.log(`[Intake Health Screening] Running analysis for dog ${dogId} with ${capturedBodyParts.length} photos`);

      const result = await emitAnalyzeRequest({
        dogId,
        userId,
        screeningType: 'intake_health_snapshot',
        dogContext,
        capturedBodyParts,
        photoEntries,
        intakeRecordId: intakeRecordId || undefined,
      });

      console.log(`[Intake Health Screening] Analysis complete - Severity: ${result.severity}, Recommendation: ${result.recommendation}`);

      // Save screening result to database
      const screeningResult = await storage.createHealthScreening({
        dogId,
        shelterId: userId,
        intakeRecordId: intakeRecordId || null,
        symptoms: null,
        imageUrls: capturedBodyParts.map(area => `intake_${area}`),
        screeningType: 'intake_health_snapshot',
        capturedBodyParts,
        severity: result.severity,
        recommendation: result.recommendation,
        aiAnalysis: result.analysis,
        conditions: result.conditions || null,
        careInstructions: result.careInstructions || null,
      });

      // Auto-create medical records for moderate/high/critical concerns via plugin
      const createdMedicalRecords = await getCreatedMedicalRecordsSync(
        dogId,
        userId,
        screeningResult.id,
        result
      );

      res.json({
        id: screeningResult.id,
        severity: result.severity,
        recommendation: result.recommendation,
        conditions: result.conditions || [],
        analysis: result.analysis,
        careInstructions: result.careInstructions,
        concernsByArea: result.concernsByArea || [],
        medicalRecordsCreated: createdMedicalRecords.length,
        medicalRecords: createdMedicalRecords,
        disclaimer: "This is an AI-powered preliminary screening. Always consult a licensed veterinarian for diagnosis and treatment.",
      });
    } catch (error: any) {
      console.error("[Intake Health Screening] Error:", error);
      res.status(500).json({ message: "Failed to complete intake health screening", error: error.message });
    }
  });

  // ============================================
  // TREATMENT PLANS API
  // ============================================

  // Get all treatment plans for the shelter
  app.get('/api/shelter/treatment-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const plans = await db.select()
        .from(schema.treatmentPlans)
        .where(eq(schema.treatmentPlans.shelterId, userId))
        .orderBy(desc(schema.treatmentPlans.createdAt));

      // Get dog info for each plan
      const dogIds = [...new Set(plans.map(p => p.dogId))];
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(sql`${schema.dogs.id} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }
      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const plansWithDogs = plans.map(plan => ({
        ...plan,
        dog: dogMap.get(plan.dogId) || null,
      }));

      res.json(plansWithDogs);
    } catch (error: any) {
      console.error("Error fetching treatment plans:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get treatment plan by ID with entries
  app.get('/api/shelter/treatment-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const [plan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, id),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!plan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      // Get entries for this plan
      const entries = await db.select()
        .from(schema.treatmentEntries)
        .where(eq(schema.treatmentEntries.treatmentPlanId, id))
        .orderBy(schema.treatmentEntries.createdAt);

      // Get dog info
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, plan.dogId));

      res.json({
        ...plan,
        dog: dog || null,
        entries,
      });
    } catch (error: any) {
      console.error("Error fetching treatment plan:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create treatment plan
  app.post('/api/shelter/treatment-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { dogId, healthScreeningId, title, description, condition, goal, priority, assignedTo, startDate, targetEndDate } = req.body;

      if (!dogId || !title) {
        return res.status(400).json({ message: "Dog ID and title are required" });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const [newPlan] = await db.insert(schema.treatmentPlans)
        .values({
          dogId,
          shelterId: userId,
          healthScreeningId: healthScreeningId || null,
          title,
          description: description || null,
          condition: condition || null,
          goal: goal || null,
          priority: priority || 'normal',
          status: 'active',
          assignedTo: assignedTo || null,
          startDate: startDate ? new Date(startDate) : new Date(),
          targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
          createdBy: userId,
        })
        .returning();

      res.status(201).json(newPlan);
    } catch (error: any) {
      console.error("Error creating treatment plan:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update treatment plan
  app.patch('/api/shelter/treatment-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const [existingPlan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, id),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!existingPlan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.condition !== undefined) updateData.condition = req.body.condition;
      if (req.body.goal !== undefined) updateData.goal = req.body.goal;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
        if (req.body.status === 'completed') {
          updateData.completedAt = new Date();
        }
      }
      if (req.body.assignedTo !== undefined) updateData.assignedTo = req.body.assignedTo;
      if (req.body.targetEndDate !== undefined) updateData.targetEndDate = req.body.targetEndDate ? new Date(req.body.targetEndDate) : null;

      const [updatedPlan] = await db.update(schema.treatmentPlans)
        .set(updateData)
        .where(eq(schema.treatmentPlans.id, id))
        .returning();

      res.json(updatedPlan);
    } catch (error: any) {
      console.error("Error updating treatment plan:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add treatment entry
  app.post('/api/shelter/treatment-plans/:planId/entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { planId } = req.params;
      const [plan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, planId),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!plan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      const { entryType, title, description, medicationName, dosage, frequency, scheduledDate, dueDate, cost } = req.body;

      if (!entryType || !title) {
        return res.status(400).json({ message: "Entry type and title are required" });
      }

      const [newEntry] = await db.insert(schema.treatmentEntries)
        .values({
          treatmentPlanId: planId,
          entryType,
          title,
          description: description || null,
          medicationName: medicationName || null,
          dosage: dosage || null,
          frequency: frequency || null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          cost: cost || null,
          status: 'pending',
          createdBy: userId,
        })
        .returning();

      res.status(201).json(newEntry);
    } catch (error: any) {
      console.error("Error creating treatment entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Complete treatment entry
  app.patch('/api/shelter/treatment-entries/:entryId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { entryId } = req.params;
      const { completionNotes } = req.body;

      // Verify entry belongs to shelter's plan
      const [entry] = await db.select()
        .from(schema.treatmentEntries)
        .where(eq(schema.treatmentEntries.id, entryId));

      if (!entry) {
        return res.status(404).json({ message: "Treatment entry not found" });
      }

      const [plan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, entry.treatmentPlanId),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!plan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      const [updatedEntry] = await db.update(schema.treatmentEntries)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completedBy: userId,
          completionNotes: completionNotes || null,
        })
        .where(eq(schema.treatmentEntries.id, entryId))
        .returning();

      res.json(updatedEntry);
    } catch (error: any) {
      console.error("Error completing treatment entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // VET REFERRALS API
  // ============================================

  // Get all vet referrals for the shelter
  app.get('/api/shelter/vet-referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const referrals = await db.select()
        .from(schema.vetReferrals)
        .where(eq(schema.vetReferrals.shelterId, userId))
        .orderBy(desc(schema.vetReferrals.createdAt));

      // Get dog info for each referral
      const dogIds = [...new Set(referrals.map(r => r.dogId))];
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(sql`${schema.dogs.id} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }
      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const referralsWithDogs = referrals.map(referral => ({
        ...referral,
        dog: dogMap.get(referral.dogId) || null,
      }));

      res.json(referralsWithDogs);
    } catch (error: any) {
      console.error("Error fetching vet referrals:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create vet referral
  app.post('/api/shelter/vet-referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { 
        dogId, healthScreeningId, treatmentPlanId, 
        reason, urgency, symptoms, aiAnalysisSummary,
        vetClinicName, vetName, vetPhone, vetEmail, vetAddress,
        appointmentDate, appointmentNotes
      } = req.body;

      if (!dogId || !reason) {
        return res.status(400).json({ message: "Dog ID and reason are required" });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const [newReferral] = await db.insert(schema.vetReferrals)
        .values({
          dogId,
          shelterId: userId,
          healthScreeningId: healthScreeningId || null,
          treatmentPlanId: treatmentPlanId || null,
          reason,
          urgency: urgency || 'routine',
          symptoms: symptoms || null,
          aiAnalysisSummary: aiAnalysisSummary || null,
          vetClinicName: vetClinicName || null,
          vetName: vetName || null,
          vetPhone: vetPhone || null,
          vetEmail: vetEmail || null,
          vetAddress: vetAddress || null,
          appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
          appointmentNotes: appointmentNotes || null,
          status: appointmentDate ? 'scheduled' : 'pending',
          createdBy: userId,
        })
        .returning();

      res.status(201).json(newReferral);
    } catch (error: any) {
      console.error("Error creating vet referral:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update vet referral
  app.patch('/api/shelter/vet-referrals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const [existingReferral] = await db.select()
        .from(schema.vetReferrals)
        .where(and(
          eq(schema.vetReferrals.id, id),
          eq(schema.vetReferrals.shelterId, userId)
        ));

      if (!existingReferral) {
        return res.status(404).json({ message: "Vet referral not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      
      // Status and scheduling
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
        if (req.body.status === 'completed') {
          updateData.completedAt = new Date();
        }
      }
      if (req.body.appointmentDate !== undefined) updateData.appointmentDate = req.body.appointmentDate ? new Date(req.body.appointmentDate) : null;
      if (req.body.appointmentNotes !== undefined) updateData.appointmentNotes = req.body.appointmentNotes;
      
      // Vet info
      if (req.body.vetClinicName !== undefined) updateData.vetClinicName = req.body.vetClinicName;
      if (req.body.vetName !== undefined) updateData.vetName = req.body.vetName;
      if (req.body.vetPhone !== undefined) updateData.vetPhone = req.body.vetPhone;
      if (req.body.vetEmail !== undefined) updateData.vetEmail = req.body.vetEmail;
      if (req.body.vetAddress !== undefined) updateData.vetAddress = req.body.vetAddress;
      
      // Outcome
      if (req.body.diagnosisFromVet !== undefined) updateData.diagnosisFromVet = req.body.diagnosisFromVet;
      if (req.body.treatmentFromVet !== undefined) updateData.treatmentFromVet = req.body.treatmentFromVet;
      if (req.body.followUpRequired !== undefined) updateData.followUpRequired = req.body.followUpRequired;
      if (req.body.followUpNotes !== undefined) updateData.followUpNotes = req.body.followUpNotes;
      if (req.body.cost !== undefined) updateData.cost = req.body.cost;

      const [updatedReferral] = await db.update(schema.vetReferrals)
        .set(updateData)
        .where(eq(schema.vetReferrals.id, id))
        .returning();

      res.json(updatedReferral);
    } catch (error: any) {
      console.error("Error updating vet referral:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create intake record for a dog
  app.post('/api/shelter/intake', isAuthenticated, async (req: any, res) => {
    console.log("[Shelter Intake] POST /api/shelter/intake called with body:", JSON.stringify(req.body));
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      const { 
        dogId, 
        pipelineStatus,
        intakeType,
        intakeReason,
        sourceInfo,
        initialCondition,
        initialWeight,
        initialNotes,
        holdType,
        holdExpiresAt,
        holdNotes
      } = req.body;

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Check if intake record already exists
      const [existingIntake] = await db.select()
        .from(schema.intakeRecords)
        .where(eq(schema.intakeRecords.dogId, dogId));

      if (existingIntake) {
        // Update existing record with all provided fields
        const updateData: any = {};
        if (pipelineStatus !== undefined) updateData.pipelineStatus = pipelineStatus;
        if (intakeType !== undefined) updateData.intakeType = intakeType;
        if (intakeReason !== undefined) updateData.intakeReason = intakeReason;
        if (sourceInfo !== undefined) updateData.sourceInfo = sourceInfo;
        if (initialCondition !== undefined) updateData.initialCondition = initialCondition;
        if (initialWeight !== undefined) updateData.initialWeight = initialWeight;
        if (initialNotes !== undefined) updateData.initialNotes = initialNotes;
        if (holdType !== undefined) updateData.holdType = holdType;
        if (holdExpiresAt !== undefined) updateData.holdExpiresAt = new Date(holdExpiresAt);
        if (holdNotes !== undefined) updateData.holdNotes = holdNotes;

        const [updatedIntake] = await db.update(schema.intakeRecords)
          .set(updateData)
          .where(eq(schema.intakeRecords.id, existingIntake.id))
          .returning();

        // Sync hold status to dog profile
        const dogUpdateData: any = {};
        if (holdType !== undefined) dogUpdateData.holdType = holdType || null;
        if (holdExpiresAt !== undefined) dogUpdateData.holdExpiresAt = holdExpiresAt ? new Date(holdExpiresAt) : null;
        if (holdNotes !== undefined) dogUpdateData.holdNotes = holdNotes || null;

        if (Object.keys(dogUpdateData).length > 0) {
          await db.update(schema.dogs)
            .set(dogUpdateData)
            .where(eq(schema.dogs.id, dogId));
          console.log(`[Intake] Synced hold status to dog ${dogId}:`, dogUpdateData);
        }

        return res.json(updatedIntake);
      }

      // Create new intake record with all provided fields
      const [newIntake] = await db.insert(schema.intakeRecords)
        .values({
          dogId,
          shelterId: shelterProfile.id,
          intakeDate: new Date(),
          intakeType: intakeType || 'owner_surrender',
          intakeReason: intakeReason || null,
          sourceInfo: sourceInfo || null,
          initialCondition: initialCondition || 'good',
          initialWeight: initialWeight ? parseInt(initialWeight) : null,
          initialNotes: initialNotes || null,
          pipelineStatus: pipelineStatus || 'intake',
          holdType: holdType || null,
          holdExpiresAt: holdExpiresAt ? new Date(holdExpiresAt) : null,
          holdNotes: holdNotes || null,
        })
        .returning();

      // Sync hold status to dog profile on new intake creation
      if (holdType || holdExpiresAt || holdNotes) {
        await db.update(schema.dogs)
          .set({
            holdType: holdType || null,
            holdExpiresAt: holdExpiresAt ? new Date(holdExpiresAt) : null,
            holdNotes: holdNotes || null,
          })
          .where(eq(schema.dogs.id, dogId));
        console.log(`[Intake] Synced initial hold status to dog ${dogId}`);
      }

      // Emit intake created event for automations
      eventBus.emit('dog.intake_created', {
        dogId,
        shelterId: shelterProfile.id,
        intakeRecordId: newIntake.id,
        pipelineStatus: newIntake.pipelineStatus || 'intake',
      });

      res.json(newIntake);
    } catch (error: any) {
      console.error("Error creating intake record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update intake record (for pipeline status changes)
  app.patch('/api/shelter/intake/:intakeId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { intakeId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Get the intake record
      const [intake] = await db.select()
        .from(schema.intakeRecords)
        .where(eq(schema.intakeRecords.id, intakeId));

      if (!intake) {
        return res.status(404).json({ message: "Intake record not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, intake.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the intake record
      const updateData: any = {};
      if (req.body.pipelineStatus !== undefined) updateData.pipelineStatus = req.body.pipelineStatus;
      if (req.body.intakeType !== undefined) updateData.intakeType = req.body.intakeType;
      if (req.body.intakeNotes !== undefined) updateData.intakeNotes = req.body.intakeNotes;
      if (req.body.strayHoldEndDate !== undefined) updateData.strayHoldEndDate = req.body.strayHoldEndDate;
      if (req.body.holdType !== undefined) updateData.holdType = req.body.holdType;
      if (req.body.holdExpiresAt !== undefined) updateData.holdExpiresAt = req.body.holdExpiresAt ? new Date(req.body.holdExpiresAt) : null;
      if (req.body.holdNotes !== undefined) updateData.holdNotes = req.body.holdNotes;

      const previousStatus = intake.pipelineStatus;
      
      const [updatedIntake] = await db.update(schema.intakeRecords)
        .set(updateData)
        .where(eq(schema.intakeRecords.id, intakeId))
        .returning();

      // Emit status change event for automations if status changed
      if (req.body.pipelineStatus !== undefined && req.body.pipelineStatus !== previousStatus) {
        const shelterProfile = await storage.getShelterProfile(userId);
        if (shelterProfile) {
          eventBus.emit('dog.status_changed', {
            dogId: intake.dogId,
            shelterId: shelterProfile.id,
            previousStatus: previousStatus || 'intake',
            newStatus: req.body.pipelineStatus,
          });
        }
        
        // Auto-complete stage-related tasks when pipeline moves
        // Find pending tasks related to the previous stage and mark them complete
        const stageTaskTypes: Record<string, string[]> = {
          'intake': ['admin', 'custom'],
          'stray_hold': ['admin', 'custom'],
          'medical_hold': ['medical', 'vaccine'],
          'behavior_eval': ['behavior_eval'],
          'pre_adoption_hold': ['admin', 'custom'],
        };
        
        const taskTypesToComplete = stageTaskTypes[previousStatus || ''] || [];
        if (taskTypesToComplete.length > 0) {
          // Complete tasks related to the stage we're leaving
          const pendingStageTasks = await db.select()
            .from(schema.shelterTasks)
            .where(and(
              eq(schema.shelterTasks.dogId, intake.dogId),
              eq(schema.shelterTasks.shelterId, userId),
              eq(schema.shelterTasks.status, 'pending'),
              inArray(schema.shelterTasks.taskType, taskTypesToComplete)
            ));
          
          for (const task of pendingStageTasks) {
            await db.update(schema.shelterTasks)
              .set({
                status: 'completed',
                completedAt: new Date(),
                completedBy: userId,
                completionNotes: `Auto-completed: Pipeline moved from ${previousStatus} to ${req.body.pipelineStatus}`,
                updatedAt: new Date(),
              })
              .where(eq(schema.shelterTasks.id, task.id));
            
            // Log automation run for explainability
            await db.insert(schema.automationRuns).values({
              shelterId: userId,
              triggerType: 'pipeline_moved',
              triggerEvent: `${dog.name} moved from ${previousStatus} to ${req.body.pipelineStatus}`,
              targetType: 'task',
              targetId: task.id,
              dogId: intake.dogId,
              actionType: 'auto_complete_task',
              actionDescription: `Completed task "${task.title}" for ${dog.name}`,
              result: 'success',
            });
          }
        }
        
        // Log dog event for timeline
        await db.insert(schema.dogEvents).values({
          dogId: intake.dogId,
          shelterId: userId,
          eventType: 'PIPELINE_MOVED',
          description: `Moved from ${previousStatus || 'intake'} to ${req.body.pipelineStatus}`,
          payload: {
            previousStatus: previousStatus || 'intake',
            newStatus: req.body.pipelineStatus,
          },
          actorType: 'user',
          actorId: userId,
        });
      }

      // Sync hold status to dog profile
      const dogUpdateData: any = {};
      if (req.body.holdType !== undefined) dogUpdateData.holdType = req.body.holdType || null;
      if (req.body.holdExpiresAt !== undefined) dogUpdateData.holdExpiresAt = req.body.holdExpiresAt ? new Date(req.body.holdExpiresAt) : null;
      if (req.body.holdNotes !== undefined) dogUpdateData.holdNotes = req.body.holdNotes || null;

      if (Object.keys(dogUpdateData).length > 0) {
        await db.update(schema.dogs)
          .set(dogUpdateData)
          .where(eq(schema.dogs.id, intake.dogId));
        console.log(`[Intake] Synced hold status to dog ${intake.dogId}:`, dogUpdateData);
      }

      // Log hold changes to dog events
      if (req.body.holdType !== undefined && req.body.holdType !== intake.holdType) {
        const holdEventType = req.body.holdType ? 'HOLD_STARTED' : 'HOLD_ENDED';
        await db.insert(schema.dogEvents).values({
          dogId: intake.dogId,
          shelterId: userId,
          eventType: holdEventType,
          description: req.body.holdType 
            ? `Hold started: ${req.body.holdType}${req.body.holdNotes ? ` - ${req.body.holdNotes}` : ''}`
            : `Hold ended (was: ${intake.holdType})`,
          payload: {
            previousHoldType: intake.holdType,
            newHoldType: req.body.holdType,
            holdNotes: req.body.holdNotes,
          },
          actorType: 'user',
          actorId: userId,
        });
      }

      // Auto-advance pipeline when hold is explicitly cleared (transition from active → cleared)
      const wasOnHold = intake.holdType !== null && intake.holdType !== '';
      const isNowCleared = req.body.holdType === null || req.body.holdType === '';
      
      if (wasOnHold && isNowCleared) {
        // Hold is being lifted - check if we should auto-advance to next stage
        const currentStatus = updatedIntake.pipelineStatus;
        if (currentStatus === 'medical_hold' || currentStatus === 'intake') {
          // Auto-advance to behavior_eval if hold is lifted
          await db.update(schema.intakeRecords)
            .set({ pipelineStatus: 'behavior_eval', pipelineStatusChangedAt: new Date() })
            .where(eq(schema.intakeRecords.id, intakeId));
          console.log(`[Intake] Auto-advanced dog ${intake.dogId} from ${currentStatus} to behavior_eval after hold cleared`);
        }
      }

      res.json(updatedIntake);
    } catch (error: any) {
      console.error("Error updating intake record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER INBOX ROUTES (Conversations & Applications)
  // ============================================

  // Unified inbox endpoint - merges applications and conversations
  app.get('/api/shelter/inbox', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type, status: filterStatus, limit: limitStr } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const limit = limitStr ? parseInt(limitStr as string) : 50;
      const inboxItems: any[] = [];

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);
      const dogMap = new Map(shelterDogs.map(d => [d.id, d]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // 1. Get applications (adoption journeys)
      if (!type || type === 'application') {
        const journeys = await db.select()
          .from(schema.adoptionJourneys)
          .where(inArray(schema.adoptionJourneys.dogId, dogIds));

        for (const journey of journeys) {
          // Filter by status if requested
          if (filterStatus && journey.status !== filterStatus) continue;

          const dog = dogMap.get(journey.dogId);
          const [applicant] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, journey.userId));

          inboxItems.push({
            id: journey.id,
            type: 'application',
            dogId: journey.dogId,
            dogName: dog?.name || 'Unknown',
            dogPhoto: dog?.photos?.[0] || null,
            applicantId: journey.userId,
            applicantName: applicant ? `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() : 'Unknown',
            applicantEmail: applicant?.email || null,
            status: journey.status,
            currentStep: journey.currentStep,
            priority: journey.status === 'pending' ? 'high' : 'normal',
            unreadCount: 0, // Applications don't have unread per se
            snippet: `${journey.currentStep} - ${journey.status}`,
            lastActivityAt: journey.updatedAt || journey.createdAt,
            createdAt: journey.createdAt,
          });
        }
      }

      // 2. Get conversations
      if (!type || type === 'conversation') {
        const conversations = await db.select()
          .from(schema.conversations)
          .where(inArray(schema.conversations.dogId, dogIds));

        for (const conv of conversations) {
          const dog = dogMap.get(conv.dogId);
          const [adopter] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, conv.userId));

          const messages = await storage.getConversationMessages(conv.id);
          const lastMessage = messages[messages.length - 1];
          const unreadCount = messages.filter(m => m.senderId !== userId && !m.isRead).length;

          // Filter by status if requested (for conversations, use unread as 'pending')
          if (filterStatus === 'pending' && unreadCount === 0) continue;
          if (filterStatus === 'read' && unreadCount > 0) continue;

          inboxItems.push({
            id: conv.id,
            type: 'conversation',
            dogId: conv.dogId,
            dogName: dog?.name || 'Unknown',
            dogPhoto: dog?.photos?.[0] || null,
            applicantId: conv.userId,
            applicantName: adopter ? `${adopter.firstName || ''} ${adopter.lastName || ''}`.trim() : 'Unknown',
            applicantEmail: adopter?.email || null,
            status: unreadCount > 0 ? 'unread' : 'read',
            priority: unreadCount > 0 ? 'high' : 'normal',
            unreadCount,
            snippet: lastMessage?.content?.substring(0, 100) || 'No messages yet',
            lastActivityAt: lastMessage?.timestamp || conv.createdAt,
            createdAt: conv.createdAt,
          });
        }
      }

      // 3. Get automation runs as system notifications (last 10)
      if (!type || type === 'system') {
        const recentAutomations = await db.select()
          .from(schema.automationRuns)
          .where(eq(schema.automationRuns.shelterId, userId))
          .orderBy(desc(schema.automationRuns.createdAt))
          .limit(10);

        for (const run of recentAutomations) {
          const dog = run.dogId ? dogMap.get(run.dogId) : null;

          inboxItems.push({
            id: run.id,
            type: 'system',
            dogId: run.dogId || null,
            dogName: dog?.name || null,
            dogPhoto: dog?.photos?.[0] || null,
            applicantId: null,
            applicantName: 'System',
            applicantEmail: null,
            status: run.result,
            priority: run.result === 'failed' ? 'high' : 'low',
            unreadCount: 0,
            snippet: run.actionDescription,
            lastActivityAt: run.createdAt,
            createdAt: run.createdAt,
          });
        }
      }

      // Sort by lastActivityAt descending
      inboxItems.sort((a, b) => {
        const dateA = new Date(a.lastActivityAt || a.createdAt).getTime();
        const dateB = new Date(b.lastActivityAt || b.createdAt).getTime();
        return dateB - dateA;
      });

      res.json(inboxItems.slice(0, limit));
    } catch (error: any) {
      console.error("Error fetching unified inbox:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all conversations for a shelter
  app.get('/api/shelter/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);
      const dogMap = new Map(shelterDogs.map(d => [d.id, d]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // Get all conversations for these dogs
      const conversations = await db.select()
        .from(schema.conversations)
        .where(inArray(schema.conversations.dogId, dogIds));

      // Enrich with dog details and last message
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const dog = dogMap.get(conv.dogId);
          const messages = await storage.getConversationMessages(conv.id);
          const lastMessage = messages[messages.length - 1];

          // Get adopter user info
          const [adopter] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, conv.userId));

          // Count unread messages for shelter
          const unreadCount = messages.filter(m => 
            m.senderId !== userId && !m.isRead
          ).length;

          return {
            ...conv,
            dog: dog || null,
            applicant: adopter || null,
            lastMessage: lastMessage?.content || null,
            unreadCount,
          };
        })
      );

      res.json(enrichedConversations);
    } catch (error: any) {
      console.error("Error fetching shelter conversations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get unread count for shelter conversations
  app.get('/api/shelter/conversations/unread/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);

      if (dogIds.length === 0) {
        return res.json({ count: 0 });
      }

      // Get all conversations for these dogs
      const conversations = await db.select()
        .from(schema.conversations)
        .where(inArray(schema.conversations.dogId, dogIds));

      // Count unread messages across all conversations
      let totalUnread = 0;
      for (const conv of conversations) {
        const messages = await storage.getConversationMessages(conv.id);
        totalUnread += messages.filter(m => 
          m.senderId !== userId && !m.isRead
        ).length;
      }

      res.json({ count: totalUnread });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.json({ count: 0 });
    }
  });

  // Get pending applications count for shelter
  app.get('/api/shelter/applications/pending/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);

      if (dogIds.length === 0) {
        return res.json({ count: 0 });
      }

      // Count pending applications (journeys in early stages - application and phone_screening)
      const [result] = await db.select({
        count: sql<number>`count(*)`
      })
        .from(schema.adoptionJourneys)
        .where(and(
          inArray(schema.adoptionJourneys.dogId, dogIds),
          inArray(schema.adoptionJourneys.currentStep, ['application', 'phone_screening']),
          eq(schema.adoptionJourneys.status, 'active')
        ));

      res.json({ count: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching pending applications count:", error);
      res.json({ count: 0 });
    }
  });

  // Get pending tasks count for shelter
  app.get('/api/shelter/tasks/pending/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      const [result] = await db.select({
        count: sql<number>`count(*)`
      })
        .from(schema.shelterTasks)
        .where(and(
          eq(schema.shelterTasks.shelterId, userId),
          eq(schema.shelterTasks.status, 'pending')
        ));

      res.json({ count: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching pending tasks count:", error);
      res.json({ count: 0 });
    }
  });

  // Get urgent dogs count for shelter
  app.get('/api/shelter/dogs/urgent/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      const [result] = await db.select({
        count: sql<number>`count(*)`
      })
        .from(schema.dogs)
        .where(and(
          eq(schema.dogs.userId, userId),
          inArray(schema.dogs.urgencyLevel, ['urgent', 'critical'])
        ));

      res.json({ count: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching urgent dogs count:", error);
      res.json({ count: 0 });
    }
  });

  // Get all applications for a shelter's dogs
  app.get('/api/shelter/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId: filterDogId } = req.query; // Optional filter by specific dog
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get all dogs belonging to this shelter (or just the specific dog if filtering)
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(filterDogId 
          ? and(eq(schema.dogs.userId, userId), eq(schema.dogs.id, filterDogId as string))
          : eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);
      const dogMap = new Map(shelterDogs.map(d => [d.id, d]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // Get all adoption journeys for these dogs
      // Show all applications for the shelter's dogs (regardless of eligibility status)
      const journeys = await db.select()
        .from(schema.adoptionJourneys)
        .where(inArray(schema.adoptionJourneys.dogId, dogIds));

      // Enrich with dog and user details
      const enrichedJourneys = await Promise.all(
        journeys.map(async (journey) => {
          const dog = dogMap.get(journey.dogId);

          // Get applicant user info
          const [applicant] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, journey.userId));

          // Get user profile
          const [profile] = await db.select()
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.userId, journey.userId));

          // Get family members
          const familyMembers = await db.select()
            .from(schema.familyMembers)
            .where(eq(schema.familyMembers.userId, journey.userId));

          // Get household pets
          const householdPets = await db.select()
            .from(schema.householdPets)
            .where(eq(schema.householdPets.userId, journey.userId));

          return {
            ...journey,
            dog: dog || null,
            user: applicant ? { 
              id: applicant.id, 
              firstName: applicant.firstName, 
              lastName: applicant.lastName, 
              email: applicant.email 
            } : null,
            userProfile: profile || null,
            familyMembers: familyMembers || [],
            householdPets: householdPets || [],
          };
        })
      );

      res.json(enrichedJourneys);
    } catch (error: any) {
      console.error("Error fetching shelter applications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update application status with proper journey flow management
  app.patch('/api/shelter/applications/:applicationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { status, advanceStep } = req.body; // advanceStep: optional boolean to also advance the journey
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the journey
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Build update object based on status and current step
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      // Journey step progression logic
      // The journey flow: application → phone_screening → meet_greet → adoption → completed
      const stepOrder = ['application', 'phone_screening', 'meet_greet', 'adoption'];
      const currentStepIndex = stepOrder.indexOf(journey.currentStep);

      // If shelter explicitly requests to advance the step, or if completing certain milestones
      if (advanceStep && currentStepIndex < stepOrder.length - 1) {
        const nextStep = stepOrder[currentStepIndex + 1];
        updateData.currentStep = nextStep;

        // Mark the current step as completed based on what step we're moving from
        if (journey.currentStep === 'application') {
          updateData.applicationSubmittedAt = journey.applicationSubmittedAt || new Date();
        } else if (journey.currentStep === 'phone_screening') {
          updateData.phoneScreeningStatus = 'completed';
          updateData.phoneScreeningCompletedAt = new Date();
        } else if (journey.currentStep === 'meet_greet') {
          updateData.meetGreetCompletedAt = new Date();
        } else if (journey.currentStep === 'adoption') {
          updateData.completedAt = new Date();
          updateData.status = 'completed';
        }
      }

      // If status is 'completed', ensure all final fields are set
      if (status === 'completed') {
        updateData.completedAt = new Date();
        updateData.currentStep = 'adoption'; // Set to final step
        // Ensure all step completion fields are set for the adopter to see the success screen
        if (!updateData.applicationSubmittedAt && !journey.applicationSubmittedAt) {
          updateData.applicationSubmittedAt = new Date();
        }
        if (!updateData.phoneScreeningCompletedAt && !journey.phoneScreeningCompletedAt) {
          updateData.phoneScreeningCompletedAt = new Date();
          updateData.phoneScreeningStatus = 'completed';
        }
        if (!updateData.meetGreetCompletedAt && !journey.meetGreetCompletedAt) {
          updateData.meetGreetCompletedAt = new Date();
        }
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set(updateData)
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      console.log(`[Journey] Updated ${applicationId}: status=${updated.status}, step=${updated.currentStep}`);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve an application (shelter decision)
  app.patch('/api/shelter/applications/:applicationId/approve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { notes } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if phone screening feature is enabled
      const enabledFlags = await storage.getEnabledFeatureFlags();
      const isPhoneScreeningEnabled = enabledFlags.some(f => f.key === 'shelter_phone_screening');

      let [updated] = await db.update(schema.adoptionJourneys)
        .set({
          shelterApprovalStatus: 'approved',
          shelterApprovedAt: new Date(),
          shelterApprovedBy: userId,
          shelterNotes: notes || null,
          // Clear rejection fields when approving
          shelterRejectedAt: null,
          shelterRejectedBy: null,
          shelterRejectionReason: null,
          status: 'active',
          currentStep: isPhoneScreeningEnabled ? 'phone_screening' : 'meet_greet',
          phoneScreeningStatus: isPhoneScreeningEnabled ? 'pending' : null,
          applicationSubmittedAt: journey.applicationSubmittedAt || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      // If phone screening is enabled, try to initiate the call automatically
      if (isPhoneScreeningEnabled) {
        const applicantProfile = await storage.getUserProfile(journey.userId);
        const phoneNumber = applicantProfile?.phoneNumber;
        
        if (phoneNumber) {
          try {
            const result = await initiatePhoneScreening(applicationId, phoneNumber);
            if (result.success) {
              console.log(`[VAPI] Phone screening initiated for journey ${applicationId}, callId: ${result.callId}`);
              // Update phoneScreeningStatus to scheduled
              [updated] = await db.update(schema.adoptionJourneys)
                .set({
                  phoneScreeningStatus: 'scheduled',
                  phoneScreeningScheduledAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(schema.adoptionJourneys.id, applicationId))
                .returning();
            } else {
              console.warn(`[VAPI] Failed to initiate phone screening for journey ${applicationId}: ${result.error}`);
              // Mark phone screening as failed
              [updated] = await db.update(schema.adoptionJourneys)
                .set({
                  phoneScreeningStatus: 'failed',
                  phoneScreeningNotes: JSON.stringify({ error: result.error }),
                  updatedAt: new Date(),
                })
                .where(eq(schema.adoptionJourneys.id, applicationId))
                .returning();
            }
          } catch (vapiError: any) {
            console.error(`[VAPI] Error initiating phone screening:`, vapiError);
            [updated] = await db.update(schema.adoptionJourneys)
              .set({
                phoneScreeningStatus: 'failed',
                phoneScreeningNotes: JSON.stringify({ error: vapiError.message }),
                updatedAt: new Date(),
              })
              .where(eq(schema.adoptionJourneys.id, applicationId))
              .returning();
          }
        } else {
          // No phone number, mark as needing phone number
          [updated] = await db.update(schema.adoptionJourneys)
            .set({
              phoneScreeningStatus: 'pending',
              phoneScreeningNotes: JSON.stringify({ warning: 'No phone number on file' }),
              updatedAt: new Date(),
            })
            .where(eq(schema.adoptionJourneys.id, applicationId))
            .returning();
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error approving application:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reject an application (shelter decision)
  app.patch('/api/shelter/applications/:applicationId/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { reason, notes } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          shelterApprovalStatus: 'rejected',
          shelterRejectedAt: new Date(),
          shelterRejectedBy: userId,
          shelterRejectionReason: reason || null,
          shelterNotes: notes || null,
          // Clear approval fields when rejecting
          shelterApprovedAt: null,
          shelterApprovedBy: null,
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: userId,
          rejectionReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error rejecting application:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Complete adoption
  app.post('/api/shelter/applications/:applicationId/complete-adoption', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { adoptionFee, notes } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          status: 'completed',
          currentStep: 'adoption',
          completedAt: new Date(),
          adoptionDate: new Date(),
          shelterApprovalStatus: 'approved',
          shelterNotes: notes ? `${journey.shelterNotes || ''}${notes}` : journey.shelterNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error completing adoption:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Schedule meet & greet
  app.post('/api/shelter/applications/:applicationId/schedule-meet-greet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { scheduledAt } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          meetGreetScheduledAt: new Date(scheduledAt),
          currentStep: 'meet_greet',
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error scheduling meet & greet:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER AVAILABILITY MANAGEMENT
  // ============================================

  // Get shelter's availability slots
  app.get('/api/shelter/availability', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const availability = await db.select()
        .from(schema.shelterAvailability)
        .where(eq(schema.shelterAvailability.shelterId, userId))
        .orderBy(schema.shelterAvailability.dayOfWeek, schema.shelterAvailability.startTime);

      res.json(availability);
    } catch (error: any) {
      console.error("Error fetching shelter availability:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create availability slot
  app.post('/api/shelter/availability', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dayOfWeek, startTime, endTime, slotDuration } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Validate time format
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ message: "Invalid time format. Use HH:MM (24-hour)." });
      }

      if (dayOfWeek < 0 || dayOfWeek > 6) {
        return res.status(400).json({ message: "Invalid day of week. Use 0-6 (Sunday-Saturday)." });
      }

      const [created] = await db.insert(schema.shelterAvailability)
        .values({
          shelterId: userId,
          dayOfWeek,
          startTime,
          endTime,
          slotDuration: slotDuration || 60,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error creating availability slot:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update availability slot
  app.patch('/api/shelter/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { dayOfWeek, startTime, endTime, slotDuration, isActive } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify ownership
      const [existing] = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.id, id),
          eq(schema.shelterAvailability.shelterId, userId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Availability slot not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (slotDuration !== undefined) updateData.slotDuration = slotDuration;
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updated] = await db.update(schema.shelterAvailability)
        .set(updateData)
        .where(eq(schema.shelterAvailability.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating availability slot:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete availability slot
  app.delete('/api/shelter/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify ownership
      const [existing] = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.id, id),
          eq(schema.shelterAvailability.shelterId, userId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Availability slot not found" });
      }

      await db.delete(schema.shelterAvailability)
        .where(eq(schema.shelterAvailability.id, id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting availability slot:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get shelter's blocked dates
  app.get('/api/shelter/blocked-dates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const blockedDates = await db.select()
        .from(schema.shelterBlockedDates)
        .where(eq(schema.shelterBlockedDates.shelterId, userId))
        .orderBy(schema.shelterBlockedDates.blockedDate);

      res.json(blockedDates);
    } catch (error: any) {
      console.error("Error fetching blocked dates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create blocked date
  app.post('/api/shelter/blocked-dates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { blockedDate, reason, allDay, startTime, endTime } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [created] = await db.insert(schema.shelterBlockedDates)
        .values({
          shelterId: userId,
          blockedDate: new Date(blockedDate),
          reason,
          allDay: allDay ?? true,
          startTime,
          endTime,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error creating blocked date:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete blocked date
  app.delete('/api/shelter/blocked-dates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify ownership
      const [existing] = await db.select()
        .from(schema.shelterBlockedDates)
        .where(and(
          eq(schema.shelterBlockedDates.id, id),
          eq(schema.shelterBlockedDates.shelterId, userId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Blocked date not found" });
      }

      await db.delete(schema.shelterBlockedDates)
        .where(eq(schema.shelterBlockedDates.id, id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting blocked date:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get available slots for a specific shelter (for adopters to book)
  app.get('/api/shelters/:shelterId/available-slots', isAuthenticated, async (req: any, res) => {
    try {
      const { shelterId } = req.params;
      const { startDate, endDate } = req.query;

      // Default to next 2 weeks if not specified
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Get shelter's availability
      const availability = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.shelterId, shelterId),
          eq(schema.shelterAvailability.isActive, true)
        ));

      if (availability.length === 0) {
        return res.json([]);
      }

      // Get blocked dates in range
      const blockedDates = await db.select()
        .from(schema.shelterBlockedDates)
        .where(and(
          eq(schema.shelterBlockedDates.shelterId, shelterId),
          gte(schema.shelterBlockedDates.blockedDate, start),
          lte(schema.shelterBlockedDates.blockedDate, end)
        ));

      // Get already booked slots (meet & greet scheduled at times)
      const bookedSlots = await db.select({
        scheduledAt: schema.adoptionJourneys.meetGreetScheduledAt
      })
        .from(schema.adoptionJourneys)
        .innerJoin(schema.dogs, eq(schema.dogs.id, schema.adoptionJourneys.dogId))
        .where(and(
          or(
            eq(schema.dogs.userId, shelterId),
            eq(schema.dogs.shelterId, shelterId)
          ),
          isNotNull(schema.adoptionJourneys.meetGreetScheduledAt),
          gte(schema.adoptionJourneys.meetGreetScheduledAt, start),
          lte(schema.adoptionJourneys.meetGreetScheduledAt, end)
        ));

      // Generate available slots
      const slots: { date: string; time: string; datetime: Date }[] = [];
      const current = new Date(start);
      current.setHours(0, 0, 0, 0);

      while (current <= end) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];

        // Check if this day is blocked
        const isBlocked = blockedDates.some(bd => {
          const blockedDateStr = new Date(bd.blockedDate).toISOString().split('T')[0];
          return blockedDateStr === dateStr && bd.allDay;
        });

        if (!isBlocked) {
          // Find availability for this day of week
          const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);

          for (const avail of dayAvailability) {
            // Generate individual time slots based on slot duration
            const [startHour, startMin] = avail.startTime.split(':').map(Number);
            const [endHour, endMin] = avail.endTime.split(':').map(Number);
            const slotDuration = avail.slotDuration;

            let slotStart = startHour * 60 + startMin;
            const slotEnd = endHour * 60 + endMin;

            while (slotStart + slotDuration <= slotEnd) {
              const slotTime = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
              const slotDateTime = new Date(current);
              slotDateTime.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);

              // Check if slot is already booked
              const isBooked = bookedSlots.some(bs => {
                if (!bs.scheduledAt) return false;
                const bookedTime = new Date(bs.scheduledAt);
                return Math.abs(bookedTime.getTime() - slotDateTime.getTime()) < slotDuration * 60 * 1000;
              });

              // Check if slot is in the past
              const isPast = slotDateTime < new Date();

              // Check if this specific time is blocked
              const isTimeBlocked = blockedDates.some(bd => {
                const blockedDateStr = new Date(bd.blockedDate).toISOString().split('T')[0];
                if (blockedDateStr !== dateStr || bd.allDay) return false;
                if (!bd.startTime || !bd.endTime) return false;
                const [blockStartH, blockStartM] = bd.startTime.split(':').map(Number);
                const [blockEndH, blockEndM] = bd.endTime.split(':').map(Number);
                const blockStart = blockStartH * 60 + blockStartM;
                const blockEnd = blockEndH * 60 + blockEndM;
                return slotStart >= blockStart && slotStart < blockEnd;
              });

              if (!isBooked && !isPast && !isTimeBlocked) {
                slots.push({
                  date: dateStr,
                  time: slotTime,
                  datetime: slotDateTime
                });
              }

              slotStart += slotDuration;
            }
          }
        }

        current.setDate(current.getDate() + 1);
      }

      res.json(slots);
    } catch (error: any) {
      console.error("Error fetching available slots:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Book a meet & greet slot (for adopters)
  app.post('/api/adoption-journeys/:journeyId/book-meet-greet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { journeyId } = req.params;
      const { datetime } = req.body;

      // Get the journey and verify ownership
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(and(
          eq(schema.adoptionJourneys.id, journeyId),
          eq(schema.adoptionJourneys.userId, userId)
        ));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      // Update the journey with the scheduled time
      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          meetGreetScheduledAt: new Date(datetime),
          currentStep: 'meet_greet',
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, journeyId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error booking meet & greet:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // CONSOLIDATED SHELTER CALENDAR
  // ============================================
  
  // Get all calendar events for shelter (availability, blocked dates, meet & greets, tasks)
  app.get('/api/shelter/calendar', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Validate date params - if provided, must be valid ISO strings
      let start: Date, end: Date;
      if (startDate) {
        const parsed = new Date(startDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid startDate format. Use ISO date string (YYYY-MM-DD or full ISO)." });
        }
        start = parsed;
      } else {
        start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }
      
      if (endDate) {
        const parsed = new Date(endDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid endDate format. Use ISO date string (YYYY-MM-DD or full ISO)." });
        }
        end = parsed;
      } else {
        end = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);
      }

      const events: any[] = [];

      // 1. Get availability windows (expand to actual dates within range)
      const availability = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.shelterId, userId),
          eq(schema.shelterAvailability.isActive, true)
        ));

      // Expand availability to specific dates
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);
        
        for (const avail of dayAvailability) {
          const [startH, startM] = avail.startTime.split(':').map(Number);
          const [endH, endM] = avail.endTime.split(':').map(Number);
          
          const eventStart = new Date(current);
          eventStart.setHours(startH, startM, 0, 0);
          
          const eventEnd = new Date(current);
          eventEnd.setHours(endH, endM, 0, 0);
          
          events.push({
            id: `avail-${avail.id}-${current.toISOString().split('T')[0]}`,
            title: 'Available for visits',
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            type: 'availability',
            color: '#22c55e', // green
            slotDuration: avail.slotDuration,
          });
        }
        current.setDate(current.getDate() + 1);
      }

      // 2. Get blocked dates
      const blockedDates = await db.select()
        .from(schema.shelterBlockedDates)
        .where(and(
          eq(schema.shelterBlockedDates.shelterId, userId),
          gte(schema.shelterBlockedDates.blockedDate, start),
          lte(schema.shelterBlockedDates.blockedDate, end)
        ));

      for (const blocked of blockedDates) {
        const blockDate = new Date(blocked.blockedDate);
        let eventStart: Date, eventEnd: Date;
        
        if (blocked.allDay) {
          eventStart = new Date(blockDate);
          eventStart.setHours(0, 0, 0, 0);
          eventEnd = new Date(blockDate);
          eventEnd.setHours(23, 59, 59, 999);
        } else if (blocked.startTime && blocked.endTime) {
          const [startH, startM] = blocked.startTime.split(':').map(Number);
          const [endH, endM] = blocked.endTime.split(':').map(Number);
          eventStart = new Date(blockDate);
          eventStart.setHours(startH, startM, 0, 0);
          eventEnd = new Date(blockDate);
          eventEnd.setHours(endH, endM, 0, 0);
        } else {
          continue;
        }

        events.push({
          id: `blocked-${blocked.id}`,
          title: blocked.reason || 'Blocked',
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
          type: 'blocked',
          color: '#ef4444', // red
          allDay: blocked.allDay,
        });
      }

      // 3. Get scheduled meet & greets
      const meetGreets = await db.select({
        id: schema.adoptionJourneys.id,
        scheduledAt: schema.adoptionJourneys.meetGreetScheduledAt,
        dogName: schema.dogs.name,
        adopterFirstName: schema.users.firstName,
        adopterLastName: schema.users.lastName,
      })
        .from(schema.adoptionJourneys)
        .innerJoin(schema.dogs, eq(schema.dogs.id, schema.adoptionJourneys.dogId))
        .innerJoin(schema.users, eq(schema.users.id, schema.adoptionJourneys.userId))
        .where(and(
          or(
            eq(schema.dogs.userId, userId),
            eq(schema.dogs.shelterId, userId)
          ),
          isNotNull(schema.adoptionJourneys.meetGreetScheduledAt),
          gte(schema.adoptionJourneys.meetGreetScheduledAt, start),
          lte(schema.adoptionJourneys.meetGreetScheduledAt, end)
        ));

      for (const mg of meetGreets) {
        if (!mg.scheduledAt) continue;
        const eventStart = new Date(mg.scheduledAt);
        const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000); // 1 hour duration
        const adopterName = [mg.adopterFirstName, mg.adopterLastName].filter(Boolean).join(' ') || 'Adopter';

        events.push({
          id: `meetgreet-${mg.id}`,
          title: `Meet & Greet: ${mg.dogName}`,
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
          type: 'meetgreet',
          color: '#3b82f6', // blue
          dogName: mg.dogName,
          adopterName: adopterName,
        });
      }

      // 4. Get shelter tasks with due dates
      const tasks = await db.select()
        .from(schema.shelterTasks)
        .where(and(
          eq(schema.shelterTasks.shelterId, userId),
          isNotNull(schema.shelterTasks.dueDate),
          gte(schema.shelterTasks.dueDate, start),
          lte(schema.shelterTasks.dueDate, end),
          not(eq(schema.shelterTasks.status, 'completed'))
        ));

      for (const task of tasks) {
        if (!task.dueDate) continue;
        const taskDate = new Date(task.dueDate);
        
        events.push({
          id: `task-${task.id}`,
          title: task.title,
          start: taskDate.toISOString(),
          end: taskDate.toISOString(),
          type: 'task',
          color: task.priority === 'urgent' ? '#f97316' : '#8b5cf6', // orange for urgent, purple otherwise
          priority: task.priority,
          taskType: task.taskType,
          allDay: true,
        });
      }

      // 5. Get upcoming vaccines
      const vaccines = await db.select({
        id: schema.medicalRecords.id,
        title: schema.medicalRecords.title,
        vaccineName: schema.medicalRecords.vaccineName,
        nextDueDate: schema.medicalRecords.nextDueDate,
        dogName: schema.dogs.name,
      })
        .from(schema.medicalRecords)
        .innerJoin(schema.dogs, eq(schema.dogs.id, schema.medicalRecords.dogId))
        .where(and(
          or(
            eq(schema.dogs.userId, userId),
            eq(schema.dogs.shelterId, userId)
          ),
          isNotNull(schema.medicalRecords.nextDueDate),
          gte(schema.medicalRecords.nextDueDate, start),
          lte(schema.medicalRecords.nextDueDate, end)
        ));

      for (const vaccine of vaccines) {
        if (!vaccine.nextDueDate) continue;
        
        events.push({
          id: `vaccine-${vaccine.id}`,
          title: `${vaccine.vaccineName || vaccine.title || 'Vaccine'} - ${vaccine.dogName}`,
          start: new Date(vaccine.nextDueDate).toISOString(),
          end: new Date(vaccine.nextDueDate).toISOString(),
          type: 'vaccine',
          color: '#06b6d4', // cyan
          dogName: vaccine.dogName,
          allDay: true,
        });
      }

      res.json(events);
    } catch (error: any) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Send message on application
  app.post('/api/shelter/applications/:applicationId/message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { content } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the journey
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Find or create conversation for this application
      let [conversation] = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.userId, journey.userId),
          eq(schema.conversations.dogId, journey.dogId)
        ));

      if (!conversation) {
        // Get shelter profile for the name
        const shelterProfile = await storage.getShelterProfile(userId);
        const shelterName = shelterProfile?.name || 'Shelter';

        [conversation] = await db.insert(schema.conversations)
          .values({
            userId: journey.userId,
            dogId: journey.dogId,
            shelterId: userId,
            shelterName,
          })
          .returning();
      }

      // Create message
      const [message] = await db.insert(schema.messages)
        .values({
          conversationId: conversation.id,
          senderId: userId,
          senderType: 'shelter_staff',
          messageType: 'text',
          content,
        })
        .returning();

      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get messages for an application
  app.get('/api/shelter/applications/:applicationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the journey
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Find conversation for this application
      const [conversation] = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.userId, journey.userId),
          eq(schema.conversations.dogId, journey.dogId)
        ));

      if (!conversation) {
        return res.json([]);
      }

      const messages = await storage.getConversationMessages(conversation.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Send message in shelter conversation
  app.post('/api/shelter/conversations/:conversationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { content } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the conversation
      const conversation = await storage.getConversation(conversationId);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, conversation.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create message
      const [message] = await db.insert(schema.messages)
        .values({
          conversationId,
          senderId: userId,
          senderType: 'shelter_staff',
          messageType: 'text',
          content,
        })
        .returning();

      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: error.message });
    }
  });
  // ============================================
  // BULK OPERATIONS API
  // ============================================

  // Get CSV template for dog import
  app.get('/api/shelter/bulk/templates/dogs', isAuthenticated, (req: any, res) => {
    const csvTemplate = `name,breed,age,ageCategory,size,weight,energyLevel,temperament,goodWithKids,goodWithDogs,goodWithCats,bio,specialNeeds,vaccinated,spayedNeutered,listingType,urgencyLevel
Max,Golden Retriever,3,adult,large,65,moderate,"friendly,playful,loyal",true,true,true,Friendly family dog,none,true,true,adoption,normal
Bella,Beagle,2,young,medium,25,high,"curious,active,gentle",true,true,false,Active and curious pup,,true,false,adoption,urgent`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=dog_import_template.csv');
    res.send(csvTemplate);
  });

  // Get CSV template for medical records import
  app.get('/api/shelter/bulk/templates/medical', isAuthenticated, (req: any, res) => {
    const csvTemplate = `dogName,recordType,title,description,veterinarian,vaccineName,performedAt,nextDueDate,cost
Max,vaccine,Rabies Vaccine,Annual rabies vaccination,Dr. Smith,rabies,2024-01-15,2025-01-15,35
Bella,exam,Wellness Check,Routine wellness examination,Dr. Johnson,,2024-02-01,,50`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=medical_import_template.csv');
    res.send(csvTemplate);
  });

  // Bulk import dogs from CSV
  app.post('/api/shelter/bulk/import/dogs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can import dogs" });
      }

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { rows, fileName } = req.body;
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const shelter = shelterProfile[0];
      const results: { success: number; errors: any[] } = { success: 0, errors: [] };

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const validated = schema.csvDogImportSchema.parse(row);

          // Determine age category from age if not provided
          let ageCategory = validated.ageCategory;
          if (!ageCategory) {
            if (validated.age < 1) ageCategory = 'puppy';
            else if (validated.age < 3) ageCategory = 'young';
            else if (validated.age < 8) ageCategory = 'adult';
            else ageCategory = 'senior';
          }

          // Parse temperament
          const temperament = validated.temperament 
            ? validated.temperament.split(',').map(t => t.trim())
            : ['friendly'];

          await db.insert(schema.dogs).values({
            userId: userId,
            name: validated.name,
            breed: validated.breed,
            age: validated.age,
            ageCategory: ageCategory,
            size: validated.size,
            weight: validated.weight,
            energyLevel: validated.energyLevel,
            temperament: temperament,
            goodWithKids: validated.goodWithKids ?? false,
            goodWithDogs: validated.goodWithDogs ?? false,
            goodWithCats: validated.goodWithCats ?? false,
            bio: validated.bio || `Meet ${validated.name}!`,
            specialNeeds: validated.specialNeeds || null,
            vaccinated: validated.vaccinated ?? false,
            spayedNeutered: validated.spayedNeutered ?? false,
            listingType: validated.listingType || 'adoption',
            urgencyLevel: validated.urgencyLevel || 'normal',
            photos: [],
            shelterId: shelter.id,
            shelterName: shelter.shelterName,
            shelterAddress: shelter.address || shelter.location,
            shelterPhone: shelter.phone,
            latitude: shelter.latitude,
            longitude: shelter.longitude,
            approvalStatus: 'approved',
          });
          results.success++;
        } catch (error: any) {
          results.errors.push({ row: i + 1, error: error.message });
        }
      }

      // Log the import
      await db.insert(schema.bulkImportLogs).values({
        shelterId: shelter.id,
        importedBy: userId,
        importType: 'dogs',
        fileName: fileName || 'csv_upload',
        totalRows: rows.length,
        successCount: results.success,
        errorCount: results.errors.length,
        errors: results.errors,
        status: 'completed',
        completedAt: new Date(),
      });

      res.json({
        message: `Imported ${results.success} of ${rows.length} dogs`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error: any) {
      console.error("Error importing dogs:", error);
      res.status(500).json({ message: error.message || "Import failed" });
    }
  });

  // Bulk import medical records from CSV
  app.post('/api/shelter/bulk/import/medical', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can import medical records" });
      }

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { rows, fileName } = req.body;
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const shelter = shelterProfile[0];

      // Get all shelter dogs for matching by name
      const shelterDogs = await db.select().from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogsByName = new Map(shelterDogs.map(d => [d.name.toLowerCase(), d]));

      const results: { success: number; errors: any[] } = { success: 0, errors: [] };

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const validated = schema.csvMedicalImportSchema.parse(row);

          const dog = dogsByName.get(validated.dogName.toLowerCase());
          if (!dog) {
            results.errors.push({ row: i + 1, error: `Dog "${validated.dogName}" not found` });
            continue;
          }

          await db.insert(schema.medicalRecords).values({
            dogId: dog.id,
            shelterId: shelter.id,
            recordType: validated.recordType,
            title: validated.title,
            description: validated.description || null,
            veterinarian: validated.veterinarian || null,
            vaccineName: validated.vaccineName || null,
            performedAt: validated.performedAt ? new Date(validated.performedAt) : new Date(),
            nextDueDate: validated.nextDueDate ? new Date(validated.nextDueDate) : null,
            cost: validated.cost || null,
            status: 'completed',
          });
          results.success++;
        } catch (error: any) {
          results.errors.push({ row: i + 1, error: error.message });
        }
      }

      // Log the import
      await db.insert(schema.bulkImportLogs).values({
        shelterId: shelter.id,
        importedBy: userId,
        importType: 'medical_records',
        fileName: fileName || 'csv_upload',
        totalRows: rows.length,
        successCount: results.success,
        errorCount: results.errors.length,
        errors: results.errors,
        status: 'completed',
        completedAt: new Date(),
      });

      res.json({
        message: `Imported ${results.success} of ${rows.length} medical records`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error: any) {
      console.error("Error importing medical records:", error);
      res.status(500).json({ message: error.message || "Import failed" });
    }
  });

  // Batch update dogs status
  app.patch('/api/shelter/bulk/dogs/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can update dogs" });
      }

      const { dogIds, updates } = req.body;
      if (!dogIds || !Array.isArray(dogIds) || dogIds.length === 0) {
        return res.status(400).json({ message: "No dogs selected" });
      }

      const validUpdates: any = {};
      if (updates.listingType) validUpdates.listingType = updates.listingType;
      if (updates.urgencyLevel) validUpdates.urgencyLevel = updates.urgencyLevel;
      if (updates.approvalStatus) validUpdates.approvalStatus = updates.approvalStatus;
      if (typeof updates.isPublic === 'boolean') validUpdates.isPublic = updates.isPublic;

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }

      await db.update(schema.dogs)
        .set(validUpdates)
        .where(and(
          inArray(schema.dogs.id, dogIds),
          eq(schema.dogs.userId, userId)
        ));

      res.json({ message: `Updated ${dogIds.length} dogs`, count: dogIds.length });
    } catch (error: any) {
      console.error("Error batch updating dogs:", error);
      res.status(500).json({ message: error.message || "Update failed" });
    }
  });

  // Bulk update intake records
  app.patch('/api/shelter/bulk/intake/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can update intake records" });
      }

      const { intakeIds, updates } = req.body;
      if (!intakeIds || !Array.isArray(intakeIds) || intakeIds.length === 0) {
        return res.status(400).json({ message: "No intake records selected" });
      }

      const validUpdates: any = {};
      if (updates.pipelineStatus) validUpdates.pipelineStatus = updates.pipelineStatus;
      if (updates.holdType !== undefined) validUpdates.holdType = updates.holdType;
      if (updates.initialCondition) validUpdates.initialCondition = updates.initialCondition;

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }

      await db.update(schema.intakeRecords)
        .set(validUpdates)
        .where(inArray(schema.intakeRecords.id, intakeIds));

      // Sync hold status to dog profiles if holdType was updated
      if (updates.holdType !== undefined) {
        // Get all intake records to find their dogIds
        const intakes = await db.select()
          .from(schema.intakeRecords)
          .where(inArray(schema.intakeRecords.id, intakeIds));
        
        const dogIds = intakes.map(i => i.dogId);
        if (dogIds.length > 0) {
          await db.update(schema.dogs)
            .set({ holdType: updates.holdType || null })
            .where(inArray(schema.dogs.id, dogIds));
          console.log(`[Bulk Intake] Synced hold status to ${dogIds.length} dogs`);
        }
      }

      res.json({ message: `Updated ${intakeIds.length} intake records`, count: intakeIds.length });
    } catch (error: any) {
      console.error("Error batch updating intake records:", error);
      res.status(500).json({ message: error.message || "Update failed" });
    }
  });

  // Bulk delete intake records
  app.delete('/api/shelter/bulk/intake', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can delete intake records" });
      }

      const { intakeIds } = req.body;
      if (!intakeIds || !Array.isArray(intakeIds) || intakeIds.length === 0) {
        return res.status(400).json({ message: "No intake records selected" });
      }

      // Delete intake records
      await db.delete(schema.intakeRecords)
        .where(inArray(schema.intakeRecords.id, intakeIds));

      res.json({ message: `Deleted ${intakeIds.length} intake records`, count: intakeIds.length });
    } catch (error: any) {
      console.error("Error batch deleting intake records:", error);
      res.status(500).json({ message: error.message || "Delete failed" });
    }
  });

  // Bulk delete dogs/pets
  app.delete('/api/shelter/bulk/dogs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can delete pets" });
      }

      const { dogIds } = req.body;
      if (!dogIds || !Array.isArray(dogIds) || dogIds.length === 0) {
        return res.status(400).json({ message: "No pets selected" });
      }

      // First delete associated intake records
      await db.delete(schema.intakeRecords)
        .where(sql`${schema.intakeRecords.dogId} = ANY(${dogIds})`);

      // Then delete the dogs
      await db.delete(schema.dogs)
        .where(sql`${schema.dogs.id} = ANY(${dogIds}) AND ${schema.dogs.userId} = ${userId}`);

      res.json({ message: `Deleted ${dogIds.length} pets`, count: dogIds.length });
    } catch (error: any) {
      console.error("Error batch deleting pets:", error);
      res.status(500).json({ message: error.message || "Delete failed" });
    }
  });

  // Bulk upload photos
  app.post('/api/shelter/bulk/photos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can upload photos" });
      }

      const { assignments } = req.body; // Array of { dogId, photos: [base64...] }
      if (!assignments || !Array.isArray(assignments)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'attached_assets', 'dog_photos');

      try {
        await fs.mkdir(uploadsDir, { recursive: true });
      } catch (err) {}

      let totalPhotos = 0;

      for (const assignment of assignments) {
        const { dogId, photos } = assignment;
        if (!dogId || !photos?.length) continue;

        // Verify dog belongs to this shelter
        const [dog] = await db.select().from(schema.dogs)
          .where(and(eq(schema.dogs.id, dogId), eq(schema.dogs.userId, userId)))
          .limit(1);

        if (!dog) continue;

        const newPhotos: string[] = [...(dog.photos || [])];

        for (const base64Data of photos) {
          const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
          const imageData = base64Match ? base64Match[2] : base64Data;
          const ext = base64Match ? base64Match[1] : 'jpg';

          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(7);
          const filename = `dog_photo_${timestamp}_${randomId}.${ext}`;
          const filePath = path.join(uploadsDir, filename);

          await fs.writeFile(filePath, imageData, 'base64');
          newPhotos.push(`/attached_assets/dog_photos/${filename}`);
          totalPhotos++;
        }

        await db.update(schema.dogs)
          .set({ photos: newPhotos })
          .where(eq(schema.dogs.id, dogId));
      }

      res.json({ message: `Uploaded ${totalPhotos} photos`, count: totalPhotos });
    } catch (error: any) {
      console.error("Error bulk uploading photos:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  // Message Templates CRUD
  app.get('/api/shelter/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const templates = await db.select().from(schema.messageTemplates)
        .where(eq(schema.messageTemplates.shelterId, shelterProfile[0].id))
        .orderBy(desc(schema.messageTemplates.updatedAt));

      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/shelter/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { name, subject, content, category, variables } = req.body;

      const [template] = await db.insert(schema.messageTemplates)
        .values({
          shelterId: shelterProfile[0].id,
          name,
          subject,
          content,
          category: category || 'general',
          variables: variables || [],
        })
        .returning();

      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk messaging
  app.post('/api/shelter/bulk/message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can send bulk messages" });
      }

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { recipientType, recipientIds, subject, content, templateId } = req.body;

      if (!content || !recipientIds?.length) {
        return res.status(400).json({ message: "Content and recipients required" });
      }

      const shelter = shelterProfile[0];
      let sentCount = 0;

      // Create messages in conversations
      for (const recipientId of recipientIds) {
        try {
          // Find or create conversation
          let [conversation] = await db.select().from(schema.conversations)
            .where(and(
              eq(schema.conversations.shelterId, shelter.id),
              eq(schema.conversations.userId, recipientId)
            ))
            .limit(1);

          if (!conversation) {
            // Get recipient's first dog conversation or create general one
            const [recipientDog] = await db.select().from(schema.dogs)
              .where(eq(schema.dogs.userId, recipientId))
              .limit(1);

            [conversation] = await db.insert(schema.conversations)
              .values({
                userId: recipientId,
                dogId: recipientDog?.id || 'general',
                shelterName: shelter.shelterName,
                shelterId: shelter.id,
                status: 'open',
              })
              .returning();
          }

          // Send message
          await db.insert(schema.messages).values({
            conversationId: conversation.id,
            senderId: userId,
            senderType: 'shelter_staff',
            messageType: 'text',
            content: content,
          });

          // Update conversation
          await db.update(schema.conversations)
            .set({
              lastMessageAt: new Date(),
              userUnreadCount: sql`${schema.conversations.userUnreadCount} + 1`,
            })
            .where(eq(schema.conversations.id, conversation.id));

          sentCount++;
        } catch (e) {
          console.error(`Failed to send to ${recipientId}:`, e);
        }
      }

      // Log bulk message
      await db.insert(schema.bulkMessageLogs).values({
        shelterId: shelter.id,
        sentBy: userId,
        templateId: templateId || null,
        subject: subject || null,
        content,
        recipientType: recipientType || 'custom',
        recipientCount: recipientIds.length,
        sentCount,
        failedCount: recipientIds.length - sentCount,
        status: 'completed',
        completedAt: new Date(),
      });

      res.json({ 
        message: `Sent to ${sentCount} of ${recipientIds.length} recipients`,
        sentCount,
        failedCount: recipientIds.length - sentCount,
      });
    } catch (error: any) {
      console.error("Error sending bulk messages:", error);
      res.status(500).json({ message: error.message || "Failed to send messages" });
    }
  });

  // Get potential message recipients
  app.get('/api/shelter/bulk/recipients', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type } = req.query; // "applicants", "adopters", "fosters"

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const shelter = shelterProfile[0];
      let recipients: any[] = [];

      if (type === 'applicants') {
        // Get users who have active applications for this shelter's dogs
        const shelterDogIds = await db.select({ id: schema.dogs.id })
          .from(schema.dogs)
          .where(eq(schema.dogs.userId, userId));

        const dogIds = shelterDogIds.map(d => d.id);

        if (dogIds.length > 0) {
          const applications = await db.select({
            userId: schema.adoptionJourneys.userId,
            user: schema.users,
          })
          .from(schema.adoptionJourneys)
          .innerJoin(schema.users, eq(schema.adoptionJourneys.userId, schema.users.id))
          .where(sql`${schema.adoptionJourneys.dogId} = ANY(${dogIds})`);

          recipients = applications.map(a => ({
            id: a.userId,
            name: `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email,
            email: a.user.email,
            type: 'applicant',
          }));
        }
      } else {
        // Get all users who have conversations with this shelter
        const convos = await db.select({
          userId: schema.conversations.userId,
          user: schema.users,
        })
        .from(schema.conversations)
        .innerJoin(schema.users, eq(schema.conversations.userId, schema.users.id))
        .where(eq(schema.conversations.shelterId, shelter.id));

        recipients = convos.map(c => ({
          id: c.userId,
          name: `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim() || c.user.email,
          email: c.user.email,
          type: 'contact',
        }));
      }

      // Dedupe
      const seen = new Set();
      recipients = recipients.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      res.json(recipients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get import history
  app.get('/api/shelter/bulk/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const imports = await db.select().from(schema.bulkImportLogs)
        .where(eq(schema.bulkImportLogs.shelterId, shelterProfile[0].id))
        .orderBy(desc(schema.bulkImportLogs.createdAt))
        .limit(20);

      res.json(imports);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

}
