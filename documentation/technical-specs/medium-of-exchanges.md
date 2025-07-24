# Medium of Exchanges Feature Documentation
## Holochain Requests and Offers Project

---

## 📋 **Executive Summary**

The **Medium of Exchanges (MoE)** feature enables communities to define and manage various payment methods and value exchange mechanisms within the requests and offers ecosystem. This feature supports both traditional currencies (USD, EUR) and alternative exchange systems (Pay It Forward, Local Exchange Trading Systems, Time Banking, etc.).

### **Key Capabilities**
- ✅ **Multi-Currency Support**: Traditional and alternative currencies
- ✅ **Admin Approval Workflow**: Suggestion → Approval/Rejection → Activation
- ✅ **hREA Integration**: Maps to ResourceSpecification entries for economic coordination
- ✅ **Entity Linking**: Associate mediums of exchange with requests and offers
- ✅ **Status Management**: Comprehensive status tracking throughout lifecycle

---

## 🏗️ **Architecture Overview**

### **System Components**

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[MoE Components]
        B[MoE Store]
        C[MoE Service]
    end
    
    subgraph "Backend Layer"
        D[MoE Coordinator Zome]
        E[MoE Integrity Zome]
        F[Administration Zome]
    end
    
    subgraph "External Integration"
        G[hREA ResourceSpec]
        H[Request/Offer Linking]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
```

### **Data Flow Architecture**
1. **User Suggestion**: Users suggest new mediums of exchange
2. **Admin Review**: Administrators review and approve/reject suggestions
3. **hREA Integration**: Approved mediums create ResourceSpecification entries
4. **Entity Association**: Link mediums to requests and offers
5. **Status Tracking**: Monitor lifecycle from suggestion to activation

---

## 🔧 **Backend Implementation**

### **Data Structure**

#### **Core Medium of Exchange Entry**
```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct MediumOfExchange {
    /// Unique identifier (e.g., 'EUR', 'USD', 'PAY_IT_FORWARD')
    pub code: String,
    /// Human-readable name (e.g., 'Euro', 'US Dollar', 'Pay it Forward')
    pub name: String,
    /// Detailed description of the medium of exchange
    pub description: Option<String>,
    /// ID of corresponding hREA ResourceSpecification (only for approved)
    pub resource_spec_hrea_id: Option<String>,
}
```

#### **Input Structures**
```rust
// Suggestion/Creation input
pub struct MediumOfExchangeInput {
    pub medium_of_exchange: MediumOfExchange,
}

// Linking input for requests/offers
pub struct MediumOfExchangeLinkInput {
    pub medium_of_exchange_hash: ActionHash,
    pub action_hash: ActionHash,
    pub entity: String, // "request" or "offer"
}

// Update links for entity
pub struct UpdateMediumOfExchangeLinksInput {
    pub action_hash: ActionHash,
    pub entity: String,
    pub new_medium_of_exchange_hashes: Vec<ActionHash>,
}
```

### **Status Management System**

The system uses **path-based status tracking** with three primary states:

#### **Status Paths**
```rust
const PENDING_MEDIUMS_OF_EXCHANGE_PATH: &str = "mediums_of_exchange.status.pending";
const APPROVED_MEDIUMS_OF_EXCHANGE_PATH: &str = "mediums_of_exchange.status.approved";  
const REJECTED_MEDIUMS_OF_EXCHANGE_PATH: &str = "mediums_of_exchange.status.rejected";
```

#### **Status Transition Workflow**
```mermaid
stateDiagram-v2
    [*] --> Pending: suggest_medium_of_exchange()
    Pending --> Approved: approve_medium_of_exchange()
    Pending --> Rejected: reject_medium_of_exchange()
    Approved --> [*]: Active for linking
    Rejected --> [*]: Cannot be used
```

### **Core API Functions**

#### **User Operations**
```rust
// Suggest new medium of exchange (accepted users + administrators)
#[hdk_extern]
pub fn suggest_medium_of_exchange(input: MediumOfExchangeInput) -> ExternResult<Record>

// Get medium of exchange details
#[hdk_extern]  
pub fn get_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<Option<Record>>

// Get latest version of medium
#[hdk_extern]
pub fn get_latest_medium_of_exchange_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>

// Get all approved mediums (public access)
#[hdk_extern]
pub fn get_approved_mediums_of_exchange(_: ()) -> ExternResult<Vec<Record>>
```

#### **Administrative Operations**
```rust
// Approve medium and create hREA ResourceSpec (admin only)
#[hdk_extern]
pub fn approve_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()>

// Reject medium (admin only)
#[hdk_extern]
pub fn reject_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()>

// Update medium details (admin only)
#[hdk_extern]
pub fn update_medium_of_exchange(input: UpdateMediumOfExchangeInput) -> ExternResult<Record>

// Delete medium (admin only)
#[hdk_extern]
pub fn delete_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()>

// Get pending mediums for review (admin only)
#[hdk_extern]
pub fn get_pending_mediums_of_exchange(_: ()) -> ExternResult<Vec<Record>>
```

#### **Entity Linking Operations**
```rust
// Create bidirectional links between medium and request/offer
#[hdk_extern]
pub fn link_to_medium_of_exchange(input: MediumOfExchangeLinkInput) -> ExternResult<()>

// Remove bidirectional links
#[hdk_extern]
pub fn unlink_from_medium_of_exchange(input: MediumOfExchangeLinkInput) -> ExternResult<()>

// Update all medium links for entity
#[hdk_extern]
pub fn update_medium_of_exchange_links(input: UpdateMediumOfExchangeLinksInput) -> ExternResult<()>

// Get all mediums linked to entity
#[hdk_extern]
pub fn get_mediums_of_exchange_for_entity(input: GetMediumOfExchangeForEntityInput) -> ExternResult<Vec<ActionHash>>
```

### **Access Control & Permissions**

#### **Permission Matrix**
| Operation | User | Accepted User | Administrator |
|-----------|------|---------------|---------------|
| Suggest Medium | ❌ | ✅ | ✅ |
| View Approved | ✅ | ✅ | ✅ |
| Approve/Reject | ❌ | ❌ | ✅ |
| Update/Delete | ❌ | ❌ | ✅ |
| View Pending | ❌ | ❌ | ✅ |
| Link to Requests/Offers | ❌ | ✅ | ✅ |

#### **Validation Rules**
```rust
// Entry validation
pub fn validate_create_medium_of_exchange(
    _action: &SignedActionHashed,
    medium_of_exchange: &MediumOfExchange,
) -> ExternResult<ValidateCallbackResult> {
    if medium_of_exchange.code.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "MediumOfExchange code cannot be empty".to_string(),
        ));
    }
    if medium_of_exchange.name.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "MediumOfExchange name cannot be empty".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}

// Author verification for updates/deletes
pub fn validate_update_medium_of_exchange(
    action: &SignedActionHashed,
    // ... parameters
) -> ExternResult<ValidateCallbackResult> {
    // Verify author matches original creator
    if action.action().author() != original_create_action.author() {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the original author can update the MediumOfExchange.".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}
```

---

## 💻 **Frontend Implementation**

### **Type System & Schemas**

#### **Core Types**
```typescript
// DHT representation (backend)
export interface MediumOfExchangeInDHT {
  code: string;
  name: string;
  description?: string | null;
  resource_spec_hrea_id?: string | null;
}

// UI representation (frontend)
export interface UIMediumOfExchange {
  actionHash: ActionHash;
  original_action_hash?: ActionHash;
  code: string;
  name: string;
  description?: string | null;
  resourceSpecHreaId?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt?: Date;
}
```

#### **Effect Schema Validation**
```typescript
export const MediumOfExchangeInDHTSchema = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  resource_spec_hrea_id: Schema.optional(Schema.Union(Schema.String, Schema.Null))
});

export const UIMediumOfExchangeSchema = Schema.Class<UIMediumOfExchange>('UIMediumOfExchange')({
  actionHash: Schema.Unknown,
  code: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  resourceSpecHreaId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  status: Schema.Literal('pending', 'approved', 'rejected'),
  createdAt: Schema.Date,
  updatedAt: Schema.optional(Schema.Date)
});
```

### **Service Layer (Effect-TS)**

#### **Service Interface**
```typescript
export interface MediumsOfExchangeService {
  readonly suggestMediumOfExchange: (
    mediumOfExchange: MediumOfExchangeInDHT
  ) => E.Effect<Record, MediumOfExchangeError>;

  readonly getMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<Record | null, MediumOfExchangeError>;

  readonly getAllMediumsOfExchange: () => E.Effect<Record[], MediumOfExchangeError>;

  readonly getPendingMediumsOfExchange: () => E.Effect<Record[], MediumOfExchangeError>;

  readonly getApprovedMediumsOfExchange: () => E.Effect<Record[], MediumOfExchangeError>;

  readonly approveMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeError>;

  readonly rejectMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeError>;

  // Entity linking operations
  readonly linkToMediumOfExchange: (input: {
    mediumOfExchangeHash: ActionHash;
    actionHash: ActionHash;
    entity: string;
  }) => E.Effect<void, MediumOfExchangeError>;

  readonly updateMediumOfExchangeLinks: (input: {
    actionHash: ActionHash;
    entity: string;
    newMediumOfExchangeHashes: ActionHash[];
  }) => E.Effect<void, MediumOfExchangeError>;
}
```

#### **Service Implementation Pattern**
```typescript
export const makeMediumsOfExchangeService = E.gen(function* () {
  const client = yield* HolochainClientServiceTag;

  const suggestMediumOfExchange = (mediumOfExchange: MediumOfExchangeInDHT) =>
    E.gen(function* () {
      const result = yield* client.callZome(
        'mediums_of_exchange',
        'suggest_medium_of_exchange',
        { medium_of_exchange: mediumOfExchange }
      );
      return yield* Schema.decodeUnknown(MediumOfExchangeRecordSchema)(result);
    }).pipe(
      E.catchAll(error => 
        E.fail(MediumOfExchangeError({
          context: MEDIUM_OF_EXCHANGE_CONTEXTS.SUGGEST_MEDIUM_OF_EXCHANGE,
          message: 'Failed to suggest medium of exchange',
          cause: error
        }))
      )
    );

  return { suggestMediumOfExchange /* ... other methods */ };
});
```

### **Store Layer (Svelte 5 + Effect-TS)**

#### **Store Factory Pattern**
```typescript
export const createMediumsOfExchangeStore = () => {
  // Reactive state with Svelte 5 Runes
  let entities = $state<UIMediumOfExchange[]>([]);
  let pendingEntities = $state<UIMediumOfExchange[]>([]);
  let approvedEntities = $state<UIMediumOfExchange[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Effect-TS operations
  const fetchAllMediumsOfExchange = E.gen(function* () {
    yield* withLoadingState(() => E.gen(function* () {
      const service = yield* MediumsOfExchangeServiceTag;
      const records = yield* service.getAllMediumsOfExchange();
      entities = mapRecordsToUIEntities(records);
    }));
  });

  const suggestMediumOfExchange = (mediumOfExchange: MediumOfExchangeInDHT) =>
    E.gen(function* () {
      const service = yield* MediumsOfExchangeServiceTag;
      const record = yield* service.suggestMediumOfExchange(mediumOfExchange);
      const uiEntity = createUIEntity(record);
      
      // Update local state
      entities = [...entities, uiEntity];
      pendingEntities = [...pendingEntities, uiEntity];
      
      // Emit event
      yield* emitMediumOfExchangeSuggested(uiEntity);
      return uiEntity;
    });

  return {
    // Reactive getters
    entities: () => entities,
    pendingEntities: () => pendingEntities,
    approvedEntities: () => approvedEntities,
    isLoading: () => isLoading,
    error: () => error,

    // Operations
    fetchAllMediumsOfExchange,
    suggestMediumOfExchange,
    approveMediumOfExchange,
    rejectMediumOfExchange
  };
};
```

### **Component Layer**

#### **MediumOfExchangeForm Component**
```svelte
<script lang="ts">
  import type { UIMediumOfExchange, MediumOfExchangeInDHT } from '$lib/schemas/mediums-of-exchange.schemas';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { runEffect } from '$lib/utils/effect';

  type Props = {
    mediumOfExchange?: UIMediumOfExchange | null;
    mode?: 'create' | 'suggest' | 'edit';
    onSubmitSuccess?: (result: UIMediumOfExchange) => void;
    onCancel?: () => void;
  };

  let { mediumOfExchange = null, mode = 'create', onSubmitSuccess, onCancel }: Props = $props();

  // Form state
  let code = $state(mediumOfExchange?.code ?? '');
  let name = $state(mediumOfExchange?.name ?? '');
  let description = $state(mediumOfExchange?.description ?? '');
  let isSubmitting = $state(false);
  let errors = $state({} as Record<string, string>);

  const isValid = $derived(
    code.trim() !== '' && name.trim() !== '' && Object.keys(errors).length === 0
  );

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    isSubmitting = true;
    
    const mediumOfExchange: MediumOfExchangeInDHT = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null
    };

    const effect = mediumsOfExchangeStore.suggestMediumOfExchange(mediumOfExchange);
    
    try {
      const result = await runEffect(effect);
      onSubmitSuccess?.(result);
    } catch (error) {
      errors = { submit: 'Failed to suggest medium of exchange' };
    } finally {
      isSubmitting = false;
    }
  };
</script>

<form on:submit={handleSubmit} class="space-y-4">
  <label class="label">
    <span>Code (e.g., USD, EUR, TIME)</span>
    <input 
      bind:value={code}
      class="input"
      placeholder="Enter unique code"
      required
    />
  </label>

  <label class="label">
    <span>Name</span>
    <input 
      bind:value={name}
      class="input"
      placeholder="Enter display name"
      required
    />
  </label>

  <label class="label">
    <span>Description (optional)</span>
    <textarea 
      bind:value={description}
      class="textarea"
      placeholder="Describe this medium of exchange"
    ></textarea>
  </label>

  <div class="flex gap-2">
    <button 
      type="submit" 
      disabled={!isValid || isSubmitting}
      class="btn variant-filled-primary"
    >
      {isSubmitting ? 'Suggesting...' : 'Suggest Medium'}
    </button>
    
    <button 
      type="button" 
      on:click={onCancel}
      class="btn variant-ghost"
    >
      Cancel
    </button>
  </div>
</form>
```

#### **MediumOfExchangeSelector Component**
```svelte
<script lang="ts">
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { onMount } from 'svelte';
  import { runEffect } from '$lib/utils/effect';

  type Props = {
    selectedMediums?: UIMediumOfExchange[];
    onSelectionChange?: (mediums: UIMediumOfExchange[]) => void;
    multiple?: boolean;
  };

  let { selectedMediums = [], onSelectionChange, multiple = true }: Props = $props();

  const approvedMediums = mediumsOfExchangeStore.approvedEntities;
  const isLoading = mediumsOfExchangeStore.isLoading;

  onMount(async () => {
    const effect = mediumsOfExchangeStore.fetchApprovedMediumsOfExchange();
    await runEffect(effect);
  });

  const handleSelectionChange = (medium: UIMediumOfExchange, selected: boolean) => {
    let newSelection: UIMediumOfExchange[];
    
    if (multiple) {
      newSelection = selected 
        ? [...selectedMediums, medium]
        : selectedMediums.filter(m => m.actionHash !== medium.actionHash);
    } else {
      newSelection = selected ? [medium] : [];
    }
    
    onSelectionChange?.(newSelection);
  };
</script>

<div class="space-y-2">
  <h4 class="h4">Select Payment Methods</h4>
  
  {#if isLoading()}
    <div class="placeholder animate-pulse">Loading payment methods...</div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
      {#each approvedMediums() as medium}
        {@const isSelected = selectedMediums.some(m => m.actionHash === medium.actionHash)}
        
        <label class="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-surface-100-800-token">
          <input 
            type={multiple ? 'checkbox' : 'radio'}
            checked={isSelected}
            on:change={(e) => handleSelectionChange(medium, e.currentTarget.checked)}
            class="checkbox"
          />
          <div class="flex-1">
            <div class="font-semibold">{medium.name}</div>
            <div class="text-sm opacity-75">{medium.code}</div>
            {#if medium.description}
              <div class="text-xs opacity-60">{medium.description}</div>
            {/if}
          </div>
        </label>
      {/each}
    </div>
  {/if}
</div>
```

---

## 🔗 **hREA Integration**

### **Economic Framework Mapping**

The Medium of Exchanges feature integrates with **hREA (Holochain Resource-Event-Agent)** framework to enable economic coordination:

#### **ResourceSpecification Mapping**
```typescript
// Medium of Exchange → hREA ResourceSpecification
export const mapMediumToResourceSpec = (medium: UIMediumOfExchange): ResourceSpecification => ({
  name: medium.name,
  note: medium.description || undefined,
  resourceClassifiedAs: [medium.code],
  defaultUnitOfResource: medium.code === 'TIME' ? 'hours' : 'units'
});
```

#### **Integration Workflow**
```mermaid
sequenceDiagram
    participant User as User
    participant App as MoE System
    participant hREA as hREA DNA
    
    User->>App: Suggest Medium (e.g., "TIME")
    App->>App: Create Entry (status: pending)
    
    User->>App: Admin Approves Medium
    App->>hREA: Create ResourceSpecification
    hREA-->>App: ResourceSpec ID
    App->>App: Update Entry (add hREA ID, status: approved)
    
    User->>App: Link Medium to Request
    App->>App: Verify Medium is Approved
    App->>App: Create Bidirectional Links
```

#### **Approval Process Enhancement**
```rust
// When approving medium, create hREA ResourceSpecification
#[hdk_extern]
pub fn approve_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()> {
    // ... admin permission check ...
    
    // TODO: Create hREA ResourceSpecification here
    // For now, placeholder ID - will be implemented with full hREA integration
    let resource_spec_id = format!("hrea_resource_spec_{}", entry.code);
    
    // Update entry with hREA ResourceSpecification ID
    let updated_entry = MediumOfExchange {
        code: entry.code,
        name: entry.name,
        description: entry.description,
        resource_spec_hrea_id: Some(resource_spec_id), // Link to hREA
    };
    
    // ... update entry and status links ...
}
```

---

## 🧪 **Testing Strategy**

### **Backend Testing (Tryorama)**

#### **Multi-Agent Test Scenarios**
```typescript
test("basic MediumOfExchange suggestion and approval workflow", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: Player, bob: Player) => {
      // Setup: Create users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
      
      const bobUser = sampleUser({ name: "Bob" });
      const bobUserRecord = await createUser(bob.cells[0], bobUser);
      
      // Register Alice as network administrator
      await registerNetworkAdministrator(alice.cells[0], aliceUserRecord.signed_action.hashed.hash);

      // Test: Bob suggests a medium of exchange
      const sampleMedium = sampleMediumOfExchange({
        code: "TIME",
        name: "Time Banking Hours"
      });
      
      const suggestedRecord = await suggestMediumOfExchange(
        bob.cells[0],
        { medium_of_exchange: sampleMedium }
      );
      
      // Verify: Medium is created and pending
      assert.ok(suggestedRecord);
      
      // Test: Alice (admin) approves the medium
      await approveMediumOfExchange(
        alice.cells[0],
        suggestedRecord.signed_action.hashed.hash
      );
      
      // Verify: Medium is now approved and has hREA ID
      const approvedMediums = await getApprovedMediumsOfExchange(alice.cells[0]);
      expect(approvedMediums).toHaveLength(1);
      
      const approvedMedium = decode(approvedMediums[0].entry) as MediumOfExchange;
      expect(approvedMedium.resource_spec_hrea_id).toBeTruthy();
    }
  );
});
```

#### **Permission Testing**
```typescript
test("unauthorized users cannot suggest mediums of exchange", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: Player, bob: Player) => {
      // Bob tries to suggest without being an accepted user
      const medium = sampleMediumOfExchange();
      
      try {
        await suggestMediumOfExchange(bob.cells[0], { medium_of_exchange: medium });
        expect.fail("Should have thrown unauthorized error");
      } catch (error) {
        expect(error.message).toContain("Unauthorized");
      }
    }
  );
});
```

#### **Entity Linking Tests**
```typescript
test("link medium of exchange to request", async () => {
  // ... setup approved medium and request ...
  
  // Link medium to request
  await linkToMediumOfExchange(alice.cells[0], {
    medium_of_exchange_hash: mediumHash,
    action_hash: requestHash,
    entity: "request"
  });
  
  // Verify bidirectional links
  const linkedRequests = await getRequestsForMediumOfExchange(alice.cells[0], mediumHash);
  expect(linkedRequests).toHaveLength(1);
  
  const linkedMediums = await getMediumsOfExchangeForEntity(alice.cells[0], {
    original_action_hash: requestHash,
    entity: "request"
  });
  expect(linkedMediums).toHaveLength(1);
});
```

### **Frontend Testing**

#### **Store Testing (Effect-TS)**
```typescript
describe('MediumsOfExchangeStore', () => {
  let store: MediumsOfExchangeStore;
  let mockService: MediumsOfExchangeService;

  beforeEach(() => {
    mockService = createMockMediumsOfExchangeService();
    store = createMediumsOfExchangeStore();
  });

  it('should suggest medium of exchange successfully', async () => {
    const medium: MediumOfExchangeInDHT = {
      code: 'TIME',
      name: 'Time Banking',
      description: 'Hour-based time banking system'
    };

    const effect = store.suggestMediumOfExchange(medium);
    const layer = Layer.succeed(MediumsOfExchangeServiceTag, mockService);
    
    const result = await runEffect(effect, layer);
    
    expect(result.code).toBe('TIME');
    expect(store.entities()).toHaveLength(1);
    expect(store.pendingEntities()).toHaveLength(1);
  });

  it('should handle approval workflow', async () => {
    // Setup pending medium
    const pendingMedium = createMockUIMediumOfExchange({ status: 'pending' });
    store.entities = [pendingMedium];
    store.pendingEntities = [pendingMedium];

    // Approve medium
    const effect = store.approveMediumOfExchange(pendingMedium.actionHash);
    await runEffect(effect, layer);

    // Verify state changes
    expect(store.pendingEntities()).toHaveLength(0);
    expect(store.approvedEntities()).toHaveLength(1);
    expect(store.approvedEntities()[0].status).toBe('approved');
  });
});
```

#### **Component Testing**
```typescript
describe('MediumOfExchangeSelector', () => {
  it('should display approved mediums for selection', () => {
    const approvedMediums = [
      createMockUIMediumOfExchange({ code: 'USD', name: 'US Dollar', status: 'approved' }),
      createMockUIMediumOfExchange({ code: 'TIME', name: 'Time Banking', status: 'approved' })
    ];

    const { container } = render(MediumOfExchangeSelector, {
      props: { approvedMediums }
    });

    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(container.textContent).toContain('US Dollar');
    expect(container.textContent).toContain('Time Banking');
  });

  it('should handle selection changes correctly', async () => {
    const onSelectionChange = vi.fn();
    const mediums = [createMockUIMediumOfExchange()];

    const { container } = render(MediumOfExchangeSelector, {
      props: { approvedMediums: mediums, onSelectionChange }
    });

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await fireEvent.click(checkbox);

    expect(onSelectionChange).toHaveBeenCalledWith([mediums[0]]);
  });
});
```

---

## 🎯 **Use Cases & Examples**

### **Traditional Currency Support**
```typescript
// Example: USD medium of exchange
const usdMedium: MediumOfExchangeInDHT = {
  code: 'USD',
  name: 'US Dollar',
  description: 'United States Dollar - traditional fiat currency'
};

// Usage in request
const request: RequestInDHT = {
  title: 'Website Development',
  description: 'Need a business website built',
  // ... other fields
};

// Link USD as accepted payment method
await linkToMediumOfExchange({
  mediumOfExchangeHash: usdMediumHash,
  actionHash: requestHash,
  entity: 'request'
});
```

### **Alternative Exchange Systems**

#### **Time Banking**
```typescript
const timeBankingMedium: MediumOfExchangeInDHT = {
  code: 'TIME',
  name: 'Time Banking Hours',
  description: 'Hour-for-hour time exchange system where all hours are valued equally'
};
```

#### **Local Exchange Trading System (LETS)**
```typescript
const letsMedium: MediumOfExchangeInDHT = {
  code: 'LETS_COMMUNITY',
  name: 'Community LETS Points',
  description: 'Local Exchange Trading System points for community resource sharing'
};
```

#### **Pay It Forward**
```typescript
const payItForwardMedium: MediumOfExchangeInDHT = {
  code: 'PAY_IT_FORWARD',
  name: 'Pay It Forward',
  description: 'No direct payment - recipient commits to helping others in the community'
};
```

### **Multi-Medium Requests**
```typescript
// Request accepting multiple payment methods
const flexibleRequest: RequestInDHT = {
  title: 'Garden Maintenance',
  description: 'Weekly garden care and maintenance',
  // ... other fields
};

// Link multiple mediums
const acceptedMediums = [usdMediumHash, timeBankingMediumHash, payItForwardMediumHash];

await updateMediumOfExchangeLinks({
  actionHash: requestHash,
  entity: 'request',
  newMediumOfExchangeHashes: acceptedMediums
});
```

---

## 🚀 **Administrative Interface**

### **Admin Dashboard Features**

#### **Pending Approvals**
```svelte
<!-- Admin dashboard showing pending mediums -->
<script lang="ts">
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  
  const pendingMediums = mediumsOfExchangeStore.pendingEntities;
  
  const handleApprove = async (medium: UIMediumOfExchange) => {
    const effect = mediumsOfExchangeStore.approveMediumOfExchange(medium.actionHash);
    await runEffect(effect);
  };
  
  const handleReject = async (medium: UIMediumOfExchange) => {
    const effect = mediumsOfExchangeStore.rejectMediumOfExchange(medium.actionHash);
    await runEffect(effect);
  };
</script>

<div class="admin-dashboard">
  <h3>Pending Medium of Exchange Approvals</h3>
  
  {#each pendingMediums() as medium}
    <div class="card p-4 mb-4">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="h4">{medium.name} ({medium.code})</h4>
          {#if medium.description}
            <p class="text-sm opacity-75">{medium.description}</p>
          {/if}
          <p class="text-xs opacity-60">Suggested: {medium.createdAt.toLocaleDateString()}</p>
        </div>
        
        <div class="flex gap-2">
          <button 
            class="btn btn-sm variant-filled-success"
            on:click={() => handleApprove(medium)}
          >
            Approve
          </button>
          <button 
            class="btn btn-sm variant-filled-error"
            on:click={() => handleReject(medium)}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  {/each}
</div>
```

#### **System Statistics**
```typescript
// Admin analytics for medium usage
interface MediumUsageStats {
  medium: UIMediumOfExchange;
  requestCount: number;
  offerCount: number;
  popularityScore: number;
}

const calculateMediumUsageStats = async (): Promise<MediumUsageStats[]> => {
  const approvedMediums = await getAllApprovedMediums();
  const stats: MediumUsageStats[] = [];
  
  for (const medium of approvedMediums) {
    const requests = await getRequestsForMediumOfExchange(medium.actionHash);
    const offers = await getOffersForMediumOfExchange(medium.actionHash);
    
    stats.push({
      medium,
      requestCount: requests.length,
      offerCount: offers.length,
      popularityScore: requests.length + offers.length
    });
  }
  
  return stats.sort((a, b) => b.popularityScore - a.popularityScore);
};
```

---

## 🔮 **Future Enhancements**

### **Phase 1: Enhanced hREA Integration**
- **Complete ResourceSpecification Creation**: Full integration with hREA DNA
- **Economic Event Tracking**: Track actual exchanges using approved mediums
- **Agreement Templates**: Pre-defined exchange agreements for common mediums

### **Phase 2: Advanced Features**
- **Exchange Rate Management**: Support for conversion rates between different mediums
- **Geographic Scope**: Regional availability and restrictions for mediums
- **Verification System**: Community verification for alternative currency systems

### **Phase 3: Analytics & Intelligence**
- **Usage Analytics**: Detailed statistics on medium popularity and usage patterns
- **Recommendation Engine**: Suggest appropriate mediums based on request/offer characteristics
- **Trend Analysis**: Track adoption of alternative currencies within the community

### **Phase 4: Integration Expansion**
- **External Currency APIs**: Real-time exchange rates for traditional currencies
- **Blockchain Integration**: Support for cryptocurrency mediums
- **Banking Integration**: Direct integration with payment processors for traditional currencies

---

## 📊 **Current Implementation Status**

### **✅ Completed Features**
- **Backend Implementation**: Complete Rust zome with all core functions
- **Status Management**: Full approval workflow with path-based tracking
- **Entity Linking**: Bidirectional linking with requests and offers
- **Access Control**: Comprehensive permission system
- **Frontend Service Layer**: Effect-TS service with error handling
- **Store Implementation**: Svelte 5 + Effect-TS reactive store
- **Basic UI Components**: Form and selector components
- **Testing Infrastructure**: Tryorama tests and frontend unit tests

### **🔄 In Progress**
- **Advanced UI Components**: Management tables, status displays
- **Admin Dashboard**: Complete administrative interface
- **hREA Integration**: Full ResourceSpecification creation workflow
- **Store Standardization**: Implementation of all 9 helper functions

### **📋 Remaining Tasks**
- **Component Completions**: Advanced search and filtering
- **Analytics Dashboard**: Usage statistics and trend analysis
- **E2E Testing**: Complete user journey testing
- **Documentation**: User guides and API documentation

---

This comprehensive documentation provides complete technical coverage of the Medium of Exchanges feature, from backend Rust implementation through frontend TypeScript/Svelte integration, including testing strategies and future enhancement roadmap.