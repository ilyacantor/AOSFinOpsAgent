# **AWS & FinOps Primer for Daniel**

**A plain English guide to understanding cloud costs and why FinOps Autopilot exists**

---

## **The Big Picture: What Problem Are We Solving?**

### **The Old Days: Buying Servers**

Imagine you're starting a company and need computers to run your website.

**10 years ago**, you'd:

1. Guess how many servers you'd need  
2. Buy them upfront ($10,000+ each)  
3. Wait 6 weeks for delivery  
4. Set them up in a closet or data center  
5. Hope you guessed right

If your app got popular, you were screwed — no servers available. If it flopped, you wasted $100K on hardware collecting dust.

### **Today: Renting from Amazon**

**Now**, companies rent computing power from Amazon Web Services (AWS):

1. Need a server? Click a button, have one in 60 seconds  
2. Need 100 servers for a big sale? Click, done  
3. Sale over? Turn them off, stop paying

This is **cloud computing**. AWS is basically a massive computer rental company.

---

## **The New Problem: The Bill is Confusing and Expensive**

Here's what happened:

**The Good**: Anyone can spin up servers instantly. Developers move fast.

**The Bad**: Anyone can spin up servers instantly. And forget about them. And leave them running. Forever.

### **Real Examples of Waste**

| What Happened | Monthly Cost | Why It Happened |
| ----- | ----- | ----- |
| Developer spun up test database, went on vacation | $800/month | Forgot to turn it off |
| Team created 50 servers for a one-time analysis | $3,000/month | Analysis done, servers still running |
| Storage volume created for a project that got cancelled | $200/month | No one knew it existed |
| Company paying for IP addresses not attached to anything | $15/month each | Engineers left the company |

**Multiply this across a company with 500 engineers, and you get AWS bills of $500K/month where 30% is pure waste.**

---

## **AWS 101: The Services That Cost Money**

Think of AWS as a menu with 200+ items. Here are the ones that matter for cost:

### **Compute (The Servers)**

**EC2 (Elastic Compute Cloud)** — Virtual servers you rent by the hour

* Like renting a computer in Amazon's data center  
* Comes in "sizes" — bigger \= more expensive  
* A small server: \~$15/month  
* A large server: \~$500/month  
* A massive server: \~$10,000/month

**Lambda** — Serverless functions

* You don't rent a whole server  
* You just run small bits of code when needed  
* Pay per millisecond of execution  
* Great for small tasks, can get expensive at scale

### **Storage (Where Data Lives)**

**EBS (Elastic Block Storage)** — Hard drives for your servers

* Every EC2 server needs a "hard drive"  
* You pay per GB per month (\~$0.10/GB)  
* **The catch**: If you delete the server but not the hard drive, you still pay  
* Old hard drives sitting around \= waste

**S3 (Simple Storage Service)** — File storage

* Like a giant Dropbox  
* Pay per GB stored \+ per download  
* Companies store terabytes here  
* Old files nobody accesses still cost money

**Snapshots** — Backups of hard drives

* Good practice to back up, but...  
* Old backups from 2 years ago? Still paying for those

### **Databases**

**RDS (Relational Database Service)** — Managed databases

* MySQL, PostgreSQL, etc. but Amazon manages them  
* Very convenient, but expensive  
* A small database: \~$50/month  
* A production database: \~$500-5,000/month  
* **Common waste**: Dev/test databases running 24/7 when only used 9-5

**Redshift** — Data warehouse

* For big data analytics  
* Clusters cost $1,000-50,000/month  
* Often sitting idle waiting for monthly reports

### **Networking**

**Elastic IPs** — Static IP addresses

* Normally free when attached to a running server  
* **But if not attached to anything: $3.65/month each**  
* Companies often have dozens of these orphaned

**NAT Gateway** — Lets private servers reach the internet

* $32/month \+ data charges  
* Often over-provisioned

**Load Balancer** — Distributes traffic across servers

* \~$16/month minimum \+ usage  
* Old ones from retired projects still running

---

## **Why Bills Get Out of Control**

### **1\. No One Owns the Bill**

* Developers create resources  
* Finance pays the bill  
* Neither fully understands the other's world  
* No one's job to optimize

### **2\. Easy to Create, Hard to Track**

* AWS console makes it easy to click "create"  
* There's no "are you sure?" when you leave something running  
* Resources get created by automation scripts at 3am

### **3\. Fear of Breaking Things**

* "That server looks unused, but what if it's important?"  
* Safer to leave it running than risk an outage  
* Waste accumulates

### **4\. Pricing is Confusing**

AWS has:

* On-demand pricing (pay as you go)  
* Reserved instances (commit for 1-3 years, save 40-70%)  
* Spot instances (bid on spare capacity, save 60-90%, but can be taken away)  
* Different prices per region, per instance type, per operating system

**No human can optimize this manually across thousands of resources.**

---

## **Enter FinOps**

**FinOps \= Financial Operations for Cloud**

It's a practice (and job title) focused on:

1. **Visibility** — Understanding where money goes  
2. **Optimization** — Reducing waste  
3. **Governance** — Preventing future waste

### **The FinOps Lifecycle**

    ┌──────────────────────────────────────┐

     │                                      │

     ▼                                      │

┌─────────┐      ┌─────────┐      ┌─────────┐

│ INFORM  │ ───▶ │OPTIMIZE │ ───▶ │ OPERATE │

│         │      │         │      │         │

│ See the │      │ Fix the │      │ Prevent │

│ waste   │      │ waste   │      │ waste   │

└─────────┘      └─────────┘      └─────────┘

---

## **What FinOps Autopilot Does**

### **The Core Idea**

Instead of humans manually hunting for waste:

1. **Automated scanning** — Continuously check for known waste patterns  
2. **Recommendations** — "Hey, this EBS volume isn't attached to anything"  
3. **Smart execution** — Fix safe things automatically, ask humans about risky things

### **The Secret Sauce: Semi-Autonomous Execution**

Most tools just show you a list of problems. You still have to fix them manually.

**FinOps Autopilot actually fixes things**, but intelligently:

| Risk Level | What We Do | Example |
| ----- | ----- | ----- |
| **Low risk** | Fix automatically | Delete unattached $50/month storage volume |
| **High risk** | Ask for approval | Resize production database |

This is the **Human-in-the-Loop (HITL)** model.

---

## **The Expansion You're Working On**

### **Currently Supported**

* EC2 instances (servers)  
* RDS databases  
* Redshift clusters

### **What You're Adding**

* EBS volumes (storage)  
* EBS snapshots (backups)  
* Elastic IPs (network addresses)  
* NAT Gateways (network routing)  
* Load Balancers (traffic distribution)  
* S3 buckets (file storage)  
* Lambda functions (serverless code)

### **Why This Matters**

With just EC2/RDS/Redshift, we catch maybe 40% of waste.

With the full list, we catch 80%+.

---

## **Waste Patterns Cheat Sheet**

Here's what "waste" looks like for each resource type:

### **EC2 Instances**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| Low CPU (\<5%) for 2 weeks | Server doing nothing | $50-500/month |
| Old generation (m4, c4) | Newer types are cheaper AND faster | 20% |
| Running on-demand 24/7 | Could use reserved or spot pricing | 40-70% |

### **EBS Volumes**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| Not attached to any server | Orphaned, pure waste | 100% of its cost |
| Type is "gp2" | gp3 is cheaper AND better | 20% |
| Very low read/write activity | Probably forgotten | 100% of its cost |

### **EBS Snapshots**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| Older than 90 days | Probably not needed | $5/month per 100GB |
| Source volume was deleted | Definitely not needed | 100% of its cost |

### **Elastic IPs**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| Not attached to anything | AWS charges for unused IPs | $3.65/month each |

### **NAT Gateways**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| Very low data transfer | Over-provisioned | $32/month |

### **RDS Databases**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| Zero connections for 7 days | Nobody using it | $50-5,000/month |
| Low CPU sustained | Could be smaller | 40% |
| Running 24/7 but it's dev/test | Should stop overnight | 65% |

### **Lambda Functions**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| Never invoked in 30 days | Dead code | Minimal but cleanup |
| Using way less memory than allocated | Over-provisioned | Proportional to memory |
| Running on x86 | ARM is 20% cheaper | 20% |

### **S3 Buckets**

| Pattern | What It Means | Typical Savings |
| ----- | ----- | ----- |
| No lifecycle policy | Old data never moves to cheaper storage | Up to 40% |
| Incomplete multipart uploads | Failed uploads taking space | 100% of that storage |

---

## **How to Think About This Project**

### **You're Building a Robot Accountant**

Think of FinOps Autopilot as a robot that:

1. Looks at the AWS bill  
2. Looks at actual usage  
3. Finds the gaps (paying for stuff not being used)  
4. Either fixes it or asks a human

### **The Technical Flow**

┌─────────────┐     ┌─────────────┐     ┌─────────────┐

│  AWS APIs   │ ──▶ │  Detection  │ ──▶ │  Decision   │

│             │     │   Engine    │     │   Engine    │

│ "What       │     │             │     │             │

│  exists?"   │     │ "Is this    │     │ "Auto-fix   │

│             │     │  waste?"    │     │  or ask?"   │

└─────────────┘     └─────────────┘     └─────────────┘

                                               │

                           ┌───────────────────┴───────────────────┐

                           │                                       │

                           ▼                                       ▼

                    ┌─────────────┐                         ┌─────────────┐

                    │ Auto-Execute│                         │   Human     │

                    │             │                         │  Approval   │

                    │ Low risk    │                         │             │

                    │ items       │                         │ High risk   │

                    └─────────────┘                         │ items       │

                                                            └─────────────┘

### **Your Task: Expand the Detection Engine**

Right now it only knows how to look at EC2, RDS, and Redshift.

You're teaching it to also look at:

* Storage (EBS volumes, snapshots, S3)  
* Networking (Elastic IPs, NAT Gateways, Load Balancers)  
* Serverless (Lambda)

This means:

1. **Expanding the database schema** — Places to store info about these new resource types  
2. **Adding detection logic** — Code that checks "is this resource wasteful?"  
3. **Generating test data** — Fake resources to test with (simulation mode)

---

## **Glossary**

| Term | Plain English |
| ----- | ----- |
| **AWS** | Amazon's cloud computing service |
| **EC2** | Virtual servers you rent |
| **EBS** | Hard drives for those servers |
| **RDS** | Managed databases |
| **S3** | File storage (like Dropbox for companies) |
| **Lambda** | Run code without managing servers |
| **Instance** | A single virtual server |
| **Volume** | A single virtual hard drive |
| **Snapshot** | A backup/copy of a volume |
| **Elastic IP** | A static IP address you can move between servers |
| **NAT Gateway** | Lets private servers reach the internet |
| **Load Balancer** | Distributes traffic across multiple servers |
| **Rightsizing** | Using a smaller (cheaper) server that still meets needs |
| **FinOps** | The practice of managing cloud costs |
| **HITL** | Human-in-the-Loop — asking humans before risky actions |
| **Utilization** | How much of a resource is actually being used |
| **On-demand** | Pay by the hour, no commitment |
| **Reserved Instance** | Commit for 1-3 years, get a discount |
| **Spot Instance** | Bid on spare capacity, cheapest but can be interrupted |

---

## **Questions to Ask If Stuck**

1. "What AWS resource type am I working with?"  
2. "What does 'waste' look like for this resource?"  
3. "What AWS API gives me the data I need?"  
4. "Is fixing this low-risk (auto) or high-risk (ask human)?"  
5. "What's the formula for calculating savings?"

---

## **Resources**

* **AWS Pricing Calculator**: https://calculator.aws — See what things cost  
* **AWS Free Tier**: https://aws.amazon.com/free — They give some stuff free for learning  
* **FinOps Foundation**: https://finops.org — Industry group defining best practices

---

Good luck Daniel\! The cloud cost problem is massive and growing. Companies waste billions of dollars a year on unused cloud resources. Anything that helps reduce that waste is genuinely valuable.

— Dad & Claude

Here's the distilled knowledge from Cloud Custodian, aws-doctor, Komiser, and others — everything you need to expand FinOps Autopilot without touching their code.

---

## **AWS Waste Detection Checklist**

### **EC2 Compute**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **Idle instances** | CloudWatch CPUUtilization avg \< 5% over 14 days | Instance hourly rate × 730 | Medium |
| **Oversized instances** | CPU \< 20% AND memory \< 20% over 7 days | (Current price \- smaller size price) × 730 | Medium |
| **Old generation instances** | Instance type starts with m4, c4, r4, t2 | \~20% savings moving to m5/c5/r5/t3 | Low |
| **Missing Spot candidates** | Non-prod instances running on-demand | 60-70% of on-demand price | Low |
| **Stopped instances with EBS** | Instance state \= stopped for \> 7 days | EBS volume costs still accruing | Low |

### **EBS Storage**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **Unattached volumes** | `ec2.describeVolumes` where Attachments \= \[\] | Size × $0.10/GB/month (gp2) | Low |
| **gp2 → gp3 migration** | VolumeType \= "gp2" | 20% savings, better IOPS | Low |
| **Oversized volumes** | Used capacity \< 20% of provisioned | Resize to actual usage \+ 20% buffer | Medium |
| **Old snapshots** | Snapshot age \> 90 days | Size × $0.05/GB/month | Low |
| **Unattached snapshots** | Snapshot's source volume deleted | Full snapshot cost | Low |

### **RDS Databases**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **Idle databases** | DatabaseConnections \= 0 for 7+ days | Full instance cost | High |
| **Oversized databases** | CPUUtilization \< 20% avg over 14 days | Downsize one tier \~40% savings | High |
| **Single-AZ in prod** | MultiAZ \= false, tagged as production | Not savings, but risk flag | Info |
| **Old generation DB instances** | db.m4, db.r4, db.t2 | \~20% savings on db.m5/r5/t3 | Medium |
| **Unencrypted databases** | StorageEncrypted \= false | Not savings, but compliance flag | Info |

### **Network**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **Unattached Elastic IPs** | `ec2.describeAddresses` where InstanceId \= null | $3.65/month each | Low |
| **Idle NAT Gateways** | BytesProcessed \< 1GB/day over 7 days | $32/month \+ data processing | Medium |
| **Idle Load Balancers** | RequestCount \= 0 for 7+ days | ALB: \~$16/month \+ LCU, NLB: \~$16/month \+ LCU | Medium |
| **Oversized NAT Gateways** | Low traffic that could use NAT instances | $32/month → \~$3/month (t3.nano) | Medium |

### **S3 Storage**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **No lifecycle policy** | Bucket has no lifecycle rules | Varies — old data should tier down | Low |
| **Standard → Intelligent Tiering** | Bucket with mixed access patterns | Up to 40% on infrequent data | Low |
| **Incomplete multipart uploads** | ListMultipartUploads with old uploads | Storage cost of orphaned parts | Low |
| **Empty buckets** | Bucket with 0 objects (forgotten) | Just cleanup, minimal cost | Low |

### **Lambda**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **Over-provisioned memory** | Max memory used \< 50% of allocated | Reduce memory, reduce cost proportionally | Low |
| **Unused functions** | Invocations \= 0 for 30+ days | Minimal, but cleanup | Low |
| **x86 → ARM migration** | Architecture \= x86\_64 | 20% cheaper on ARM (Graviton) | Low |

### **Redshift**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **Idle clusters** | DatabaseConnections \= 0 for 7+ days | Full cluster cost | High |
| **Oversized clusters** | CPUUtilization \< 20% sustained | Downsize node count or type | High |
| **No pause schedule** | Dev/test clusters running 24/7 | Pause outside business hours \~65% savings | Medium |

### **Other Quick Wins**

| Pattern | Detection Logic | Savings Calculation | Risk |
| ----- | ----- | ----- | ----- |
| **CloudWatch Log retention** | Log groups with retention \= Never | Old logs add up — set 30/90 day retention | Low |
| **Unused ECR images** | Images not pulled in 90+ days | Storage costs | Low |
| **Idle Elasticsearch/OpenSearch** | No indexing or search requests 7+ days | Full cluster cost | High |
| **Unattached EFS** | No mount targets or 0 connections | Minimum $0.30/GB/month | Low |

---

## **AWS API Calls Reference**

// EC2 & EBS  
ec2.describeInstances()  
ec2.describeVolumes()  
ec2.describeSnapshots()  
ec2.describeAddresses()  
ec2.describeNatGateways()

// CloudWatch (for utilization)  
cloudwatch.getMetricStatistics({  
  Namespace: 'AWS/EC2',  // or AWS/RDS, AWS/Lambda, etc.  
  MetricName: 'CPUUtilization',  
  Period: 86400,  // 1 day  
  Statistics: \['Average'\],  
  StartTime: 14 days ago,  
  EndTime: now  
})

// RDS  
rds.describeDBInstances()

// S3  
s3.listBuckets()  
s3.getBucketLifecycleConfiguration()  
s3.listMultipartUploads()

// Lambda  
lambda.listFunctions()  
lambda.getFunction()  
cloudwatch.getMetricStatistics({ Namespace: 'AWS/Lambda', MetricName: 'Invocations' })

// ELB  
elbv2.describeLoadBalancers()  
elbv2.describeTargetGroups()

// Cost data  
costexplorer.getCostAndUsage()

---

## **Risk Classification for Your HITL Router**

| Risk Level | Auto-Execute? | Examples |
| ----- | ----- | ----- |
| **Low** | ✅ Autonomous | Unattached EBS, old snapshots, Elastic IPs, gp2→gp3 |
| **Medium** | ⚠️ HITL recommended | Rightsizing, NAT gateway changes, idle load balancers |
| **High** | 🛑 Always HITL | Anything touching RDS, Redshift, production-tagged resources |
| **Info** | No action | Compliance flags, suggestions |

---

## **Prompt Template for Claude Code**

When you're ready to add any of these:

Add detection for \[PATTERN NAME\] to heuristic-engine.ts:

Detection: \[COPY THE DETECTION LOGIC\]  
Savings: \[COPY THE CALCULATION\]  
Risk: \[Low/Medium/High\]

Use existing AWS service in server/services/aws.ts  
Create recommendation following existing schema  
Include resourceId, resourceType, estimatedSavings, confidence score

---

This gives you maybe 30+ new detection patterns whenever you have cycles. Each one is a 15-30 minute Claude Code task, no integration overhead, fits your existing architecture.

Exactly right. Here's the minimal schema expansion to support those detection patterns:

---

## **Current vs Expanded Resource Types**

**You have now:**

* EC2 instances  
* RDS databases  
* Redshift clusters

**You'd add:**

* EBS volumes  
* EBS snapshots  
* Elastic IPs  
* NAT Gateways  
* Load Balancers (ALB/NLB)  
* S3 buckets  
* Lambda functions  
* CloudWatch Log Groups

---

## **Schema Expansion (Drizzle ORM)**

Add to your `shared/schema.ts`:

// Expanded resource types enum

export const resourceTypeEnum \= pgEnum('resource\_type', \[

  // Compute

  'ec2\_instance',

  'lambda\_function',


  // Database

  'rds\_instance',

  'redshift\_cluster',


  // Storage

  'ebs\_volume',

  'ebs\_snapshot',

  's3\_bucket',


  // Network

  'elastic\_ip',

  'nat\_gateway',

  'load\_balancer',


  // Other

  'cloudwatch\_log\_group'

\]);

// Expanded recommendation types

export const recommendationTypeEnum \= pgEnum('recommendation\_type', \[

  // Existing

  'rightsizing',

  'scheduling',

  'storage\_tiering',


  // New

  'termination',        // Delete unused resource

  'migration',          // e.g., gp2→gp3, x86→ARM

  'cleanup',            // Old snapshots, orphaned resources

  'configuration'       // Lifecycle policies, retention settings

\]);

// New: Resource metrics table (for utilization tracking)

export const resourceMetrics \= pgTable('resource\_metrics', {

  id: serial('id').primaryKey(),

  tenantId: text('tenant\_id').notNull(),

  resourceId: text('resource\_id').notNull(),

  resourceType: resourceTypeEnum('resource\_type').notNull(),

  metricName: text('metric\_name').notNull(),      // 'cpu\_utilization', 'memory\_used', 'connections', etc.

  metricValue: real('metric\_value').notNull(),

  metricUnit: text('metric\_unit'),                // 'percent', 'bytes', 'count'

  timestamp: timestamp('timestamp').defaultNow(),


  // Index for fast lookups

}, (table) \=\> ({

  resourceIdx: index('metrics\_resource\_idx').on(table.tenantId, table.resourceId),

  timestampIdx: index('metrics\_timestamp\_idx').on(table.timestamp),

}));

// Expand existing resources table (add columns)

// Or if you prefer, here's what the full table should look like:

export const resources \= pgTable('resources', {

  id: serial('id').primaryKey(),

  tenantId: text('tenant\_id').notNull(),

  resourceId: text('resource\_id').notNull().unique(),

  resourceType: resourceTypeEnum('resource\_type').notNull(),

  resourceName: text('resource\_name'),

  region: text('region').default('us-east-1'),


  // Flexible metadata (different per resource type)

  metadata: jsonb('metadata').$type\<ResourceMetadata\>(),


  // Cost tracking

  monthlyCost: real('monthly\_cost'),

  hourlyCost: real('hourly\_cost'),


  // State

  status: text('status'),                         // 'running', 'stopped', 'available', etc.

  lastSeen: timestamp('last\_seen').defaultNow(),

  createdAt: timestamp('created\_at').defaultNow(),


  // Tags (for environment detection)

  tags: jsonb('tags').$type\<Record\<string, string\>\>(),

});

---

## **Metadata Type Definitions**

// Flexible metadata per resource type

type ResourceMetadata \= 

  | EC2Metadata

  | EBSVolumeMetadata

  | EBSSnapshotMetadata

  | RDSMetadata

  | S3Metadata

  | LambdaMetadata

  | NetworkMetadata;

interface EC2Metadata {

  instanceType: string;

  platform: string;

  architecture: 'x86\_64' | 'arm64';

  launchTime: string;

}

interface EBSVolumeMetadata {

  volumeType: 'gp2' | 'gp3' | 'io1' | 'io2' | 'st1' | 'sc1';

  sizeGb: number;

  iops: number;

  attachedTo: string | null;      // EC2 instance ID or null if unattached

}

interface EBSSnapshotMetadata {

  sizeGb: number;

  sourceVolumeId: string | null;  // null if source volume deleted

  createdAt: string;

}

interface RDSMetadata {

  instanceClass: string;

  engine: string;

  multiAz: boolean;

  encrypted: boolean;

}

interface S3Metadata {

  bucketSizeBytes: number;

  objectCount: number;

  hasLifecyclePolicy: boolean;

  storageClass: string;

}

interface LambdaMetadata {

  runtime: string;

  memoryMb: number;

  architecture: 'x86\_64' | 'arm64';

  lastInvoked: string | null;

}

interface NetworkMetadata {

  // For Elastic IPs

  attachedTo?: string | null;


  // For NAT Gateways

  bytesProcessedLast7Days?: number;


  // For Load Balancers

  type?: 'application' | 'network';

  targetGroupCount?: number;

}

---

## **Key Metrics to Collect**

| Resource Type | Metrics to Store |
| ----- | ----- |
| **ec2\_instance** | cpu\_utilization, memory\_percent, network\_in, network\_out |
| **rds\_instance** | cpu\_utilization, db\_connections, free\_storage\_space |
| **ebs\_volume** | volume\_read\_ops, volume\_write\_ops |
| **lambda\_function** | invocations, duration, memory\_used\_max |
| **nat\_gateway** | bytes\_in, bytes\_out |
| **load\_balancer** | request\_count, active\_connections |

---

## **Simulation Data Expansion**

For your simulation mode, expand the synthetic data generator:

const syntheticResources \= \[

  // Existing EC2/RDS/Redshift...


  // EBS Volumes \- mix of states

  { resourceType: 'ebs\_volume', metadata: { volumeType: 'gp2', sizeGb: 100, attachedTo: 'i-abc123' }},

  { resourceType: 'ebs\_volume', metadata: { volumeType: 'gp2', sizeGb: 500, attachedTo: null }},  // Unattached\!

  { resourceType: 'ebs\_volume', metadata: { volumeType: 'gp3', sizeGb: 200, attachedTo: 'i-def456' }},


  // Snapshots \- some old

  { resourceType: 'ebs\_snapshot', metadata: { sizeGb: 100, createdAt: '2024-06-01' }},  // Old\!

  { resourceType: 'ebs\_snapshot', metadata: { sizeGb: 50, sourceVolumeId: null }},      // Orphaned\!


  // Elastic IPs

  { resourceType: 'elastic\_ip', metadata: { attachedTo: null }, monthlyCost: 3.65 },   // Unattached\!

  { resourceType: 'elastic\_ip', metadata: { attachedTo: 'i-abc123' }, monthlyCost: 0 },


  // NAT Gateways

  { resourceType: 'nat\_gateway', metadata: { bytesProcessedLast7Days: 500000 }},       // Idle\!


  // Lambda

  { resourceType: 'lambda\_function', metadata: { memoryMb: 1024, architecture: 'x86\_64', lastInvoked: null }},


  // S3

  { resourceType: 's3\_bucket', metadata: { hasLifecyclePolicy: false, bucketSizeBytes: 1000000000 }},

\];

---

## **Claude Code Prompt**

When you're ready to implement:

Expand the FinOps Autopilot data model to support additional AWS resource types.

1\. Update shared/schema.ts:

   \- Add resource types: ebs\_volume, ebs\_snapshot, elastic\_ip, nat\_gateway, load\_balancer, s3\_bucket, lambda\_function, cloudwatch\_log\_group

   \- Add recommendation types: termination, migration, cleanup, configuration

   \- Add resourceMetrics table for utilization tracking

   \- Add metadata JSONB column to resources table

   \- Add tags JSONB column to resources table

2\. Update simulation data generator to create synthetic data for new resource types, including:

   \- 2 unattached EBS volumes (waste)

   \- 3 gp2 volumes (migration candidates)

   \- 5 old snapshots \> 90 days

   \- 2 unattached Elastic IPs

   \- 1 idle NAT gateway

   \- 2 Lambda functions (1 over-provisioned, 1 unused)

   \- 1 S3 bucket without lifecycle policy

3\. Generate appropriate metrics history for the new resources

Follow existing patterns in the codebase.

---

This gives you the data foundation. Once the schema is expanded, each detection pattern from the checklist becomes a simple query \+ recommendation insert.

