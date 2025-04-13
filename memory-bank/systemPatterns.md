# System Patterns

## Architecture Overview

### Core Architecture
1. **Distributed Backend (Holochain)**
   - DNA-based modular architecture
   - Peer-to-peer networking
   - Local-first data storage
   - Cryptographic validation

2. **Frontend Architecture**
   - SvelteKit application framework
   - Component-based UI structure
   - Effect-based functional patterns
   - Reactive state management

3. **Data Flow**
   - GraphQL API layer
   - ValueFlows integration
   - Entity caching
   - Optimistic updates

## Design Patterns

### Frontend Patterns

1. **Project Structure**
   ```typescript
   src/
   ├── lib/
   │   ├── components/    // Feature-based organization
   │   │   ├── requests/  // Request-specific components
   │   │   ├── offers/    // Offer-specific components
   │   │   ├── shared/    // Shared components
   │   │   └── ui/        // Base UI components
   │   ├── stores/        // Global state management
   │   ├── services/      // API and state services
   │   ├── types/         // TypeScript definitions
   │   └── utils/         // Shared utilities
   └── routes/            // SvelteKit routes
   ```

2. **Component Organization**
   ```typescript
   // Feature-based Component Structure
   src/lib/components/requests/
   ├── RequestForm.svelte       // Create/Edit form
   ├── RequestList.svelte       // List view
   ├── RequestCard.svelte       // Card component
   ├── RequestDetails.svelte    // Detailed view
   └── RequestFilters.svelte    // Filter controls

   src/lib/components/shared/
   ├── layout/                  // Layout components
   ├── forms/                   // Form elements
   ├── navigation/              // Navigation components
   └── feedback/                // User feedback components
   ```

3. **Svelte 5 Component Pattern**
   ```svelte
   <script lang="ts">
   // TypeScript Component with Props
   function RequestCard() {
     let { 
       request,
       onSelect = () => {},
       showDetails = false 
     } = $props<RequestCardProps>();
     
     // Reactive state using runes
     let isExpanded = $state(false);
     let error = $state<Error | null>(null);
     
     // Computed values using $derived
     let statusClass = $derived(getStatusClass(request.status));
     let displayDate = $derived(formatDate(request.created_at));
     
     // Side effects with cleanup
     $effect(() => {
       const timer = setInterval(() => {
         // Update relative time
       }, 60000);
       
       return () => clearInterval(timer);
     });
     </script>
     
     <div class={statusClass}>
         <h3>{request.title}</h3>
         <p>{request.description}</p>
         <button onclick={() => onSelect(request)}>
           View Details
         </button>
       </div>
     );
   }
   ```

4. **Store Pattern**
   ```typescript
   // Store with TypeScript and Runes
   function createRequestStore() {
     // Reactive state
     let requests = $state<Request[]>([]);
     let loading = $state(false);
     let error = $state<Error | null>(null);
     
     // Computed values
     let activeRequests = $derived(
       requests.filter(r => r.status === 'active')
     );
     
     // Actions
     async function fetchRequests() {
       loading = true;
       error = null;
       try {
         requests = await requestService.getAll();
       } catch (e) {
         error = e instanceof Error ? e : new Error(String(e));
       } finally {
         loading = false;
       }
     }
     
     return {
       requests,
       loading,
       error,
       activeRequests,
       fetchRequests
     };
   }
   ```

5. **Form Handling Pattern**
   ```typescript
   function RequestForm() {
     // Form props with validation schema
     let { onSubmit } = $props<RequestFormProps>();
     
     // Form state
     let form = createForm<RequestFormData>({
       validate: zodValidator(requestSchema),
       onSubmit: async (values) => {
         const result = await requestService.create(values);
         result.match({
           ok: (data) => onSubmit(data),
           err: (error) => handleError(error)
         });
       }
     });
     
     return (
       <form use:form.enhance>
         <InputField
           name="title"
           label="Title"
           error={form.errors?.title}
         />
         <TextArea
           name="description"
           label="Description"
           error={form.errors?.description}
         />
         <button type="submit" disabled={form.submitting}>
           {form.submitting ? 'Creating...' : 'Create Request'}
         </button>
       </form>
     );
   }
   ```

6. **Event Handling Pattern**
   ```typescript
   function RequestList() {
     let { onRequestSelect } = $props<RequestListProps>();
     
     // Event handlers using arrow functions
     const handleSelect = (request: Request) => {
       onRequestSelect(request);
     };
     
     const handleFilter = (filters: RequestFilters) => {
       // Update filters
     };
     
     return (
       <div>
         <RequestFilters onFilter={handleFilter} />
         {requests.map(request => (
           <RequestCard
             request={request}
             onclick={() => handleSelect(request)}
           />
         ))}
       </div>
     );
   }
   ```

7. **Children and Slots Pattern**
   ```typescript
   function RequestLayout() {
     let { children, sidebar } = $props<LayoutProps>();
     
     return (
       <div class="layout">
         {sidebar && <Sidebar />}
         <main>
           {@render children?.()}
         </main>
       </div>
     );
   }
   ```

8. **Accessibility Pattern**
   ```typescript
   function RequestCard() {
     let { request } = $props<RequestCardProps>();
     
     return (
       <article
         role="article"
         aria-labelledby={`request-${request.id}-title`}
       >
         <h2 id={`request-${request.id}-title`}>
           {request.title}
         </h2>
         <div aria-live="polite">
           {request.status}
         </div>
         <button
           onclick={() => handleSelect(request)}
           aria-label={`View details for ${request.title}`}
         >
           View Details
         </button>
       </article>
     );
   }
   ```

### Backend Patterns

1. **DNA Structure**
   ```rust
   // Zome Organization
   coordinator/
     ├── requests/
     │   ├── create.rs
     │   ├── update.rs
     │   └── delete.rs
     └── offers/
         ├── create.rs
         ├── update.rs
         └── delete.rs
   ```

2. **Entry Types**
   ```rust
   // Entry Definition Pattern
   #[hdk_entry_helper]
   #[derive(Clone)]
   pub struct Request {
       pub title: String,
       pub description: String,
       pub status: RequestStatus,
   }
   ```

3. **Link Types**
   ```rust
   // Link Pattern
   #[hdk_link_types]
   pub enum LinkTypes {
       RequestToOffer,
       UserToRequest,
       CategoryToRequest,
   }
   ```

## Component Patterns

### UI Components

1. **Form Components**
   ```svelte
   <!-- Form Pattern -->
   <script lang="ts">
     let { form } = createForm<FormData>({
       validate: zodValidator(schema),
       onSubmit: handleSubmit
     })
   </script>
   ```

2. **List Components**
   ```svelte
   <!-- List Pattern -->
   <script lang="ts">
     let items: Item[] = []
     $: filtered = items.filter(filterFn)
   </script>
   ```

3. **Layout Components**
   ```svelte
   <!-- Layout Pattern -->
   <script lang="ts">
     export let sidebar = true
     export let header = true
   </script>
   ```

### Service Patterns

1. **API Services**
   ```typescript
   // Service Pattern
   class RequestService {
     async create(data: RequestInput): Promise<Request> {
       return this.client.mutate({
         mutation: CREATE_REQUEST,
         variables: { input: data }
       })
     }
   }
   ```

2. **State Services**
   ```typescript
   // State Service Pattern
   class StateService {
     private store = writable<State>(initialState)
     
     update(data: Partial<State>) {
       this.store.update(s => ({ ...s, ...data }))
     }
   }
   ```

3. **Utility Services**
   ```typescript
   // Utility Pattern
   class ValidationService {
     static validate<T>(data: T, schema: ZodSchema<T>) {
       return schema.safeParse(data)
     }
   }
   ```

## Testing Patterns

### Unit Tests

1. **Component Tests**
   ```typescript
   // Component Test Pattern
   describe('RequestForm', () => {
     it('validates input', async () => {
       const { getByRole } = render(RequestForm)
       // Test implementation
     })
   })
   ```

2. **Service Tests**
   ```typescript
   // Service Test Pattern
   describe('RequestService', () => {
     it('creates request', async () => {
       const service = new RequestService()
       // Test implementation
     })
   })
   ```

### Integration Tests

1. **API Tests**
   ```typescript
   // API Test Pattern
   describe('Request API', () => {
     it('handles full request lifecycle', async () => {
       // Test implementation
     })
   })
   ```

2. **Flow Tests**
   ```typescript
   // Flow Test Pattern
   describe('Request Flow', () => {
     it('completes request-offer cycle', async () => {
       // Test implementation
     })
   })
   ```

## Error Handling

### Frontend Errors

1. **Component Error Boundaries**
   ```svelte
   <!-- Error Boundary Pattern -->
   <script lang="ts">
     let error: Error | null = null
     
     function handleError(e: Error) {
       error = e
     }
   </script>
   ```

2. **Service Error Handling**
   ```typescript
   // Service Error Pattern
   class ErrorHandler {
     static handle(error: Error) {
       logger.error(error)
       notifyUser(error.message)
     }
   }
   ```

### Backend Errors

1. **Zome Error Handling**
   ```rust
   // Error Pattern
   #[derive(Debug, Serialize, Deserialize)]
   pub enum RequestError {
     ValidationError(String),
     NotFound(String),
     Unauthorized,
   }
   ```

2. **Result Handling**
   ```rust
   // Result Pattern
   pub fn create_request(
     request: Request
   ) -> ExternResult<ActionHash> {
     // Implementation with error handling
   }
   ```

## Performance Patterns

### Frontend Performance

1. **Lazy Loading**
   ```typescript
   // Lazy Load Pattern
   const RequestDetail = lazy(() => 
     import('./RequestDetail')
   )
   ```

2. **Caching**
   ```typescript
   // Cache Pattern
   const cache = new EntityCache<Request>({
     ttl: 5 * 60 * 1000, // 5 minutes
     maxSize: 100
   })
   ```

### Backend Performance

1. **Batch Operations**
   ```rust
   // Batch Pattern
   pub fn batch_create_requests(
     requests: Vec<Request>
   ) -> ExternResult<Vec<ActionHash>> {
     // Implementation
   }
   ```

2. **Query Optimization**
   ```rust
   // Query Pattern
   pub fn get_requests_by_status(
     status: RequestStatus
   ) -> ExternResult<Vec<Request>> {
     // Optimized implementation
   }
   ```

## Security Patterns

### Data Validation

1. **Input Validation**
   ```typescript
   // Validation Pattern
   const schema = z.object({
     title: z.string().min(1).max(100),
     description: z.string().min(1),
     status: z.enum(['OPEN', 'CLOSED'])
   })
   ```

2. **Access Control**
   ```rust
   // Access Pattern
   fn validate_author(
     action: &SignedActionHashed
   ) -> ExternResult<bool> {
     // Implementation
   }
   ```

## Integration Patterns

### ValueFlows Integration

1. **Economic Events**
   ```typescript
   // Event Pattern
   interface EconomicEvent {
     action: string
     provider: Agent
     receiver: Agent
     resourceInventoriedAs: EconomicResource
   }
   ```

2. **Resource Tracking**
   ```typescript
   // Resource Pattern
   interface EconomicResource {
     id: string
     name: string
     trackingIdentifier: string
   }
   ```

### GraphQL Integration

1. **Query Resolution**
   ```typescript
   // Resolver Pattern
   const resolvers = {
     Query: {
       requests: async () => {
         // Implementation
       }
     }
   }
   ```

2. **Mutation Handling**
   ```typescript
   // Mutation Pattern
   const mutations = {
     createRequest: async (
       _: any,
       { input }: { input: RequestInput }
     ) => {
       // Implementation
     }
   }
   ```

## Entry and Link Patterns

### User Entry Structure
- **UserUpdates**: User create header → update headers
- **UserAgents**: User → agent associations
- **AllUsers**: Global user index
- **MyUser**: Current agent → user
- **UserRequests/Offers**: User → requests/offers
- **UserProjects**: User → projects
- **UserOrganizations**: User → organizations
- **UserSkills**: User → skills

### Project/Organization Structure
- **AllProjects/Organizations**: Global indexes
- **Project/OrganizationCoordinators**: Entity → coordinators
- **Project/OrganizationMembers**: Entity → members
- **Project/OrganizationCategories**: Entity → categories
- **Project/OrganizationRequests**: Entity → requests
- **Project/OrganizationOffers**: Entity → offers

### Skills and Categories
- **AllSkills/Categories**: Global indexes
- **Skill/CategoryUsers**: Entity → users
- **Skill/CategoryProjects**: Entity → projects
- **Skill/CategoryRequests**: Entity → requests
- **Skill/CategoryOffers**: Entity → offers

## Administration Patterns
- **Progenitor Pattern**: First agent becomes admin
- **AdministratorsUser**: Administrators anchor → user
- **ModeratorsUser**: Moderators anchor → user
- **Suspension Management**: Temporary/permanent with history
- **Flagging System**: Community-driven moderation

## State Management
- Svelte 5 runes for reactive state
- Global stores for shared state
- Proper effect handling and cleanup
- TypeScript interfaces for store states

## Error Handling
- Result type pattern for operations
- Proper error propagation
- User-friendly error messages
- Logging and monitoring

## Security Patterns
- Role-based access control
- Proper input validation
- Secure data storage
- Cryptographic best practices
- Verification workflows

## Testing Patterns
- Unit testing with Tryorama
- Component testing
- Integration testing
- E2E testing strategy

## UI/UX Patterns
- Consistent component structure
- Accessibility patterns
- Responsive design
- Progressive enhancement
- Search functionality in all major sections


### Service Layer Patterns

1. **Effect-based Service Pattern**
   ```typescript
   // Service Type Definition with Effect
   export type RequestsService = {
     createRequest: (
       request: RequestInDHT,
       organizationHash?: ActionHash
     ) => E.Effect<never, RequestError, Record>;
     getLatestRequest: (
       originalActionHash: ActionHash
     ) => E.Effect<never, RequestError, RequestInDHT | null>;
   };

   // Service Implementation
   export function createRequestsService(hc: HolochainClientService): RequestsService {
     const createRequest = (
       request: RequestInDHT,
       organizationHash?: ActionHash
     ): E.Effect<never, RequestError, Record> =>
       pipe(
         E.tryPromise({
           try: () =>
             hc.callZome('requests', 'create_request', {
               request,
               organization: organizationHash
             }),
           catch: (error: unknown) => 
             RequestError.fromError(error, 'Failed to create request')
         }),
         E.map((record: unknown) => record as Record)
       );
     
     return { createRequest };
   }
   ```

2. **Error Handling Pattern**
   ```typescript
   // Custom Error Classes
   export class RequestError extends Error {
     constructor(
       message: string,
       public readonly cause?: unknown
     ) {
       super(message);
       this.name = 'RequestError';
     }

     static fromError(error: unknown, context: string): RequestError {
       if (error instanceof Error) {
         return new RequestError(`${context}: ${error.message}`, error);
       }
       return new RequestError(`${context}: ${String(error)}`, error);
     }
   }
   ```

### Store Layer Patterns

1. **Entity Store Pattern**
   ```typescript
   export type RequestsStore = {
     readonly requests: UIRequest[];
     readonly loading: boolean;
     readonly error: string | null;
     readonly cache: EntityCache<UIRequest>;
     getAllRequests: () => E.Effect<never, RequestStoreError, UIRequest[]>;
     // ... other methods
   };

   // Store Implementation with Effect
   export function createRequestsStore(
     requestsService: RequestsService,
     eventBus: EventBus<StoreEvents>
   ): RequestsStore {
     // Reactive State with Svelte 5 Runes
     const requests: UIRequest[] = $state([]);
     let loading: boolean = $state(false);
     let error: string | null = $state(null);

     const getAllRequests = (): E.Effect<never, RequestStoreError, UIRequest[]> =>
       pipe(
         E.sync(() => {
           loading = true;
           error = null;
         }),
         E.flatMap(() => {
           const cachedRequests = cache.getAllValid();
           if (cachedRequests.length > 0) {
             return E.succeed(cachedRequests);
           }
           return requestsService.getAllRequestsRecords();
         }),
         E.map(mapToUIRequests),
         E.tap((uiRequests) => E.sync(() => {
           uiRequests.forEach(req => cache.set(req));
         })),
         E.catchAll((error) => {
           const storeError = RequestStoreError.fromError(error, 'Failed to get all requests');
           return E.fail(storeError);
         }),
         E.tap(() => E.sync(() => { loading = false; }))
       );
     
     return { requests, loading, error, getAllRequests };
   }
   ```

2. **Cache Management Pattern**
   ```typescript
   // Cache Configuration
   const cache = createEntityCache<UIRequest>({
     expiryMs: 5 * 60 * 1000, // 5 minutes
     debug: false
   });

   // Cache Event Handling
   cache.on('cache:set', ({ entity }) => {
     const index = requests.findIndex(
       (r) => r.original_action_hash?.toString() === entity.original_action_hash?.toString()
     );

     if (index !== -1) {
       requests[index] = entity;
     } else {
       requests.push(entity);
     }
   });
   ```

3. **Effect-based Store Operations**
   ```typescript
   const getAllRequests = (): E.Effect<never, RequestStoreError, UIRequest[]> =>
     pipe(
       E.sync(() => {
         loading = true;
         error = null;
       }),
       E.flatMap(() => {
         const cachedRequests = cache.getAllValid();
         if (cachedRequests.length > 0) {
           return E.succeed(cachedRequests);
         }
         
         return pipe(
           E.all([
             requestsService.getAllRequestsRecords(),
             // ... other operations
           ]),
           // Transform and cache results
         );
       }),
       E.catchAll((error) => {
         const storeError = RequestStoreError.fromError(error, 'Failed to get all requests');
         return E.fail(storeError);
       }),
       E.tap(() =>
         E.sync(() => {
           loading = false;
         })
       )
     );
   ```

4. **Event Bus Integration Pattern**
   ```typescript
   // Event Emission
   const createRequest = (
     request: RequestInDHT,
     organizationHash?: ActionHash
   ): E.Effect<never, RequestStoreError, Record> =>
     pipe(
       // ... operation logic ...
       E.map((record) => {
         // ... processing ...
         cache.set(newRequest);
         eventBus.emit('request:created', { request: newRequest });
         return record;
       })
     );
   ```

5. **Data Transformation Pattern**
   ```typescript
   // Mapping Functions with Effect
   const mapToUIRequest = (
     record: Record,
     userProfile?: UserProfile,
     organizationHash?: ActionHash
   ): E.Effect<never, TransformError, UIRequest> =>
     pipe(
       E.try(() => ({
         ...decodeRecords<RequestInDHT>([record])[0],
         original_action_hash: record.signed_action.hashed.hash,
         previous_action_hash: record.signed_action.hashed.hash,
         creator: userProfile?.original_action_hash || record.signed_action.hashed.content.author,
         organization: organizationHash,
         created_at: record.signed_action.hashed.content.timestamp,
         updated_at: record.signed_action.hashed.content.timestamp
       })),
       E.mapError(error => new TransformError('Failed to transform record', error))
     );
   ``` 

## Future Pattern Considerations
- Advanced matching algorithms
- Reputation system design
- Mutual credit implementation
- Contribution accounting
- Complex reporting systems