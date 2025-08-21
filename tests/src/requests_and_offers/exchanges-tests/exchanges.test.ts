import { assert, test } from 'vitest'
import { Scenario, Player } from '@holochain/tryorama'
import { runScenarioWithTwoAgents } from '../utils.js'
import { createUser, sampleUser } from '../users/common.js'
import { registerNetworkAdministrator } from '../administration/common.js'
import {
  createServiceType,
  sampleServiceType,
  ServiceTypeInput,
} from '../service-types-tests/common.js'
import { 
  createRequest,
  sampleRequest,
  RequestInput,
} from '../requests-tests/common.js'
import { sampleResponseInput } from './common.js'

test('Exchange Response Duplicate Prevention', async () => {
  await runScenarioWithTwoAgents(async (_scenario: Scenario, alice: Player, bob: Player) => {
    // Set up users first
    const aliceUser = sampleUser({ name: 'Alice' })
    const aliceUserRecord = await createUser(alice.cells[0], aliceUser)
    console.log('✅ Alice user created')

    const bobUser = sampleUser({ name: 'Bob' })
    const bobUserRecord = await createUser(bob.cells[0], bobUser)
    console.log('✅ Bob user created')

    // Make Alice an admin
    await registerNetworkAdministrator(alice.cells[0], alice.agentPubKey)
    console.log('✅ Alice registered as admin')

    // 1. Alice creates a service type
    const serviceTypeInput: ServiceTypeInput = { service_type: sampleServiceType() }
    const serviceType = await createServiceType(alice.cells[0], serviceTypeInput)
    console.log('✅ Service type created')

    // 2. Alice creates a request
    const requestInput: RequestInput = { 
      request: sampleRequest(), 
      service_type_hash: serviceType.signed_action.hashed.hash 
    }
    const createRequestResult = await createRequest(alice.cells[0], requestInput)
    const requestHash = createRequestResult.signed_action.hashed.hash
    console.log('✅ Request created')

    // 3. Bob creates first response to Alice's request
    const responseInput = sampleResponseInput(requestHash)
    const firstResponse = await bob.cells[0].callZome({
      zome_name: 'exchanges',
      fn_name: 'create_exchange_response',
      payload: responseInput,
    })
    console.log('✅ First response created:', firstResponse.signed_action.hashed.hash)

    // 4. Bob tries to create a second response to the same request
    try {
      const secondResponse = await bob.cells[0].callZome({
        zome_name: 'exchanges',
        fn_name: 'create_exchange_response',
        payload: responseInput,
      })
      
      // If we reach here, the duplicate was not prevented - this should fail the test
      assert.fail('Expected error when creating duplicate response, but creation succeeded')
    } catch (error: any) {
      // Check that the error message is correct
      console.log('✅ Duplicate response correctly prevented:', error.message)
      assert(
        error.message.includes('already have a pending response'),
        `Expected duplicate prevention error, but got: ${error.message}`
      )
    }

    // 5. Alice approves the first response
    await alice.cells[0].callZome({
      zome_name: 'exchanges',
      fn_name: 'update_response_status',
      payload: {
        response_hash: firstResponse.signed_action.hashed.hash,
        new_status: 'Approved',
        reason: 'Good proposal',
      },
    })
    console.log('✅ First response approved by Alice')

    // 6. Now Bob should be able to create another response (since the previous one is no longer pending)
    const thirdResponse = await bob.cells[0].callZome({
      zome_name: 'exchanges',
      fn_name: 'create_exchange_response',
      payload: {
        ...responseInput,
        service_details: 'Updated service proposal',
      },
    })
    console.log('✅ New response allowed after previous was approved:', thirdResponse.signed_action.hashed.hash)

    // Verify all responses exist
    const allResponses = await bob.cells[0].callZome({
      zome_name: 'exchanges',
      fn_name: 'get_responses_for_entity',
      payload: requestHash,
    })
    console.log('📊 Total responses:', allResponses.length)
    assert(allResponses.length === 2, `Expected 2 responses, got ${allResponses.length}`)
  })
})