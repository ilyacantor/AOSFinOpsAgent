# **FinOps Autopilot Expansion — User Stories**

**For: Daniel** **How to test: Look at the UI. Do the numbers make sense?**

---

## **Story 1: New Resource Types Appear in Dashboard**

**As a** FinOps analyst  
 **I want** to see all AWS resource types in the dashboard  
 **So that** I get the full picture of our cloud spend

**How to verify:**

1. Open the dashboard in simulation mode  
2. Look at the resources panel  
3. You should see:  
   * EC2 instances ✓ (already works)  
   * RDS databases ✓ (already works)  
   * EBS volumes (NEW)  
   * EBS snapshots (NEW)  
   * Elastic IPs (NEW)  
   * NAT Gateways (NEW)  
   * Load Balancers (NEW)  
   * S3 buckets (NEW)  
   * Lambda functions (NEW)  
4. Total resource count should be 20+ (not just 6\)

**The KPI tells the story:** Resource count goes from \~6 to \~20+

---

## **Story 2: More Savings Identified**

**As a** FinOps analyst  
 **I want** the system to find waste across all resource types  
 **So that** I see the true savings opportunity

**How to verify:**

1. Open the dashboard in simulation mode  
2. Look at "Identified Savings" KPI  
3. Wait 30 seconds for recommendations to generate  
4. Savings should be higher than before (more waste patterns detected)  
5. Recommendations panel should show different types:  
   * "Delete unattached EBS volume"  
   * "Migrate gp2 to gp3"  
   * "Release unused Elastic IP"  
   * "Delete old snapshot"  
   * etc.

**The KPI tells the story:** Identified Savings increases significantly

---

## **Story 3: Low-Risk Items Auto-Execute**

**As a** FinOps analyst  
 **I want** safe optimizations to happen automatically  
 **So that** I don't waste time approving obvious wins

**How to verify:**

1. Open the dashboard in simulation mode  
2. Watch the recommendations panel  
3. Low-risk items (unattached volumes, old snapshots, unused Elastic IPs) should:  
   * Appear briefly as "Autonomous"  
   * Auto-execute within seconds  
   * Move to completed  
4. "Realized Savings" KPI should increase automatically

**The KPI tells the story:** Realized Savings climbs without you clicking anything

---

## **Story 4: High-Risk Items Wait for Approval**

**As a** FinOps analyst  
 **I want** risky changes to require my approval  
 **So that** the system doesn't break anything important

**How to verify:**

1. Open the dashboard in simulation mode  
2. Look for recommendations tagged "HITL" or "Pending"  
3. These should be things like:  
   * NAT Gateway changes  
   * Load Balancer deletions  
   * Database modifications  
4. Click "Approve" on one → it should execute  
5. Click "Reject" on one → it should disappear  
6. These should NOT auto-execute

**The KPI tells the story:** Some recommendations stay pending until you act

---

## **Story 5: Waste Percentage Improves Over Time**

**As a** FinOps analyst  
 **I want** to see waste percentage decrease as optimizations run  
 **So that** I can prove value to leadership

**How to verify:**

1. Open the dashboard in simulation mode  
2. Note the "Waste %" or similar KPI at start  
3. Wait 2-3 minutes as autonomous recommendations execute  
4. Waste % should decrease (or Optimized % should increase)  
5. The gap between "Identified" and "Realized" savings should shrink

**The KPI tells the story:** Waste % goes down over time

---

## **Story 6: Simulation Creates Realistic Waste Patterns**

**As a** developer or demo user  
 **I want** simulation mode to show realistic scenarios  
 **So that** demos are compelling and testing is meaningful

**How to verify:**

1. Start fresh in simulation mode  
2. Look at the generated resources — do they look real?  
   * Volume names like "vol-0a1b2c3d" not "test123"  
   * Mix of healthy and wasteful resources  
   * Realistic costs ($3.65 for Elastic IP, $50-500 for volumes)  
3. Recommendations should make sense  
   * "This volume is unattached" → volume actually shows no attachment  
   * "This snapshot is 120 days old" → date math checks out  
4. Nothing obviously broken or placeholder

**The KPI tells the story:** A non-technical person watching the demo would believe it's real data

---

## **Quick Test Checklist**

| \# | Test | Pass? |
| ----- | ----- | ----- |
| 1 | Dashboard shows 20+ resources (not just 6\) |  |
| 2 | See recommendations for EBS, snapshots, Elastic IPs, etc. |  |
| 3 | Identified Savings is higher than before expansion |  |
| 4 | Low-risk items auto-execute, Realized Savings increases |  |
| 5 | High-risk items show "Pending", require click to approve |  |
| 6 | Waste % decreases over time as optimizations run |  |
| 7 | Simulation data looks realistic (not placeholder) |  |

---

## **If Something Looks Wrong**

1. **Resource count still low?** → Data model expansion didn't work  
2. **No new recommendation types?** → Detection logic not added  
3. **Everything requires approval?** → Risk classification wrong  
4. **Nothing auto-executes?** → Autonomous mode might be off (check Settings)  
5. **Savings not calculating?** → Cost formulas missing

---

That's it. Six stories, one checklist. If the KPIs move in the right direction, it works.

