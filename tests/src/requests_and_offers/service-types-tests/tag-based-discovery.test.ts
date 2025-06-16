import { assert, test } from "vitest";
import { Scenario, Player, dhtSync } from "@holochain/tryorama";
import { decodeRecords, runScenarioWithTwoAgents } from "../utils";
import { createUser, sampleUser } from "../users/common";
import { registerNetworkAdministrator } from "../administration/common";
import {
  createRequest,
  sampleRequest,
  getRequestsByTag,
} from "../requests-tests/common";
import {
  createOffer,
  sampleOffer,
  getOffersByTag,
} from "../offers-tests/common";
import {
  createServiceType,
  sampleServiceTypeWithTags,
  getServiceTypesByTag,
  getAllServiceTypeTags,
  ServiceType,
} from "./common";
import type { Request } from "../requests-tests/common";

// Test for discovering requests by tag
test(
  "Tag-based request discovery",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create service types with specific tags
        const webDevServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Web Development", [
            "javascript",
            "react",
            "frontend",
            "backend",
          ]),
        });

        const mobileDevServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Mobile Development", [
            "javascript",
            "react-native",
            "mobile",
            "ios",
            "android",
          ]),
        });

        const designServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("UI/UX Design", [
            "design",
            "ui",
            "ux",
            "figma",
            "prototyping",
          ]),
        });
        await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Data Science", [
            "python",
            "machine-learning",
            "data",
            "analytics",
          ]),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create requests with different service types
        await createRequest(
          alice.cells[0],
          sampleRequest({
            title: "Need React Developer",
            description: "Looking for a React developer for my startup",
          }),
          undefined,
          [webDevServiceType.signed_action.hashed.hash]
        );

        await createRequest(
          bob.cells[0],
          sampleRequest({
            title: "Full Stack Web App",
            description: "Need someone to build a complete web application",
          }),
          undefined,
          [webDevServiceType.signed_action.hashed.hash]
        );

        await createRequest(
          alice.cells[0],
          sampleRequest({
            title: "iOS App Development",
            description: "Need to build a mobile app for iOS",
          }),
          undefined,
          [mobileDevServiceType.signed_action.hashed.hash]
        );

        await createRequest(
          bob.cells[0],
          sampleRequest({
            title: "UI Design for Website",
            description: "Need beautiful UI design for my website",
          }),
          undefined,
          [designServiceType.signed_action.hashed.hash]
        );

        await createRequest(
          alice.cells[0],
          sampleRequest({
            title: "Full Product Development",
            description: "Need both web development and design",
          }),
          undefined,
          [
            webDevServiceType.signed_action.hashed.hash,
            designServiceType.signed_action.hashed.hash,
          ]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test: Get requests by "javascript" tag
        const jsRequests = await getRequestsByTag(alice.cells[0], "javascript");
        assert.lengthOf(
          jsRequests,
          4,
          "Should find 4 requests with 'javascript' tag (2 web + 1 mobile + 1 multi-service)"
        );

        const jsRequestTitles = jsRequests.map((record) => {
          const decoded = decodeRecords<Request>([record])[0];
          return decoded.title;
        });
        assert.include(jsRequestTitles, "Need React Developer");
        assert.include(jsRequestTitles, "Full Stack Web App");
        assert.include(jsRequestTitles, "iOS App Development");
        assert.include(jsRequestTitles, "Full Product Development");

        // Test: Get requests by "design" tag
        const designRequests = await getRequestsByTag(alice.cells[0], "design");
        assert.lengthOf(
          designRequests,
          2,
          "Should find 2 requests with 'design' tag"
        );

        const designRequestTitles = designRequests.map((record) => {
          const decoded = decodeRecords<Request>([record])[0];
          return decoded.title;
        });
        assert.include(designRequestTitles, "UI Design for Website");
        assert.include(designRequestTitles, "Full Product Development");

        // Test: Get requests by "mobile" tag
        const mobileRequests = await getRequestsByTag(alice.cells[0], "mobile");
        assert.lengthOf(
          mobileRequests,
          1,
          "Should find 1 request with 'mobile' tag"
        );

        const mobileDecoded = decodeRecords<Request>([mobileRequests[0]])[0];
        assert.equal(mobileDecoded.title, "iOS App Development");

        // Test: Get requests by non-existent tag
        const nonExistentRequests = await getRequestsByTag(
          alice.cells[0],
          "nonexistent"
        );
        assert.lengthOf(
          nonExistentRequests,
          0,
          "Should find no requests with non-existent tag"
        );
      }
    );
  },
  { timeout: 180000 }
);

// Test for discovering offers by tag
test(
  "Tag-based offer discovery",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create service types with specific tags
        const webDevServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Web Development", [
            "javascript",
            "react",
            "nodejs",
            "frontend",
            "backend",
          ]),
        });

        const designServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Graphic Design", [
            "design",
            "photoshop",
            "branding",
            "logo",
          ]),
        });

        const writingServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Content Writing", [
            "writing",
            "copywriting",
            "content",
            "marketing",
          ]),
        });

        await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Business Consulting", [
            "consulting",
            "strategy",
            "business",
            "analysis",
          ]),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create offers with different service types
        await createOffer(
          alice.cells[0],
          sampleOffer({
            title: "React Development Services",
            description: "I can build React applications",
          }),
          undefined,
          [webDevServiceType.signed_action.hashed.hash]
        );

        await createOffer(
          bob.cells[0],
          sampleOffer({
            title: "Full Stack Web Development",
            description: "Complete web application development",
          }),
          undefined,
          [webDevServiceType.signed_action.hashed.hash]
        );

        await createOffer(
          alice.cells[0],
          sampleOffer({
            title: "Logo Design Services",
            description: "Professional logo and branding design",
          }),
          undefined,
          [designServiceType.signed_action.hashed.hash]
        );

        await createOffer(
          bob.cells[0],
          sampleOffer({
            title: "Content Writing",
            description: "SEO-optimized content writing",
          }),
          undefined,
          [writingServiceType.signed_action.hashed.hash]
        );

        await createOffer(
          alice.cells[0],
          sampleOffer({
            title: "Complete Digital Package",
            description: "Web development + design + content",
          }),
          undefined,
          [
            webDevServiceType.signed_action.hashed.hash,
            designServiceType.signed_action.hashed.hash,
            writingServiceType.signed_action.hashed.hash,
          ]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test: Get offers by "javascript" tag
        const jsOffers = await getOffersByTag(alice.cells[0], "javascript");
        assert.lengthOf(
          jsOffers,
          3,
          "Should find 3 offers with 'javascript' tag (2 web + 1 multi-service)"
        );

        // Test: Get offers by "design" tag
        const designOffers = await getOffersByTag(alice.cells[0], "design");
        assert.lengthOf(
          designOffers,
          2,
          "Should find 2 offers with 'design' tag"
        );

        // Test: Get offers by "writing" tag
        const writingOffers = await getOffersByTag(alice.cells[0], "writing");
        assert.lengthOf(
          writingOffers,
          2,
          "Should find 2 offers with 'writing' tag"
        );

        // Test: Get offers by non-existent tag
        const nonExistentOffers = await getOffersByTag(
          alice.cells[0],
          "nonexistent"
        );
        assert.lengthOf(
          nonExistentOffers,
          0,
          "Should find no offers with non-existent tag"
        );
      }
    );
  },
  { timeout: 180000 }
);

// Test for cross-entity tag discovery (requests and offers with same tags)
test(
  "Cross-entity tag discovery - requests and offers with shared tags",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create a service type with shared tags
        const sharedServiceType = await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Full Stack Development", [
            "javascript",
            "react",
            "nodejs",
            "database",
            "api",
          ]),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Create requests and offers with the same service type
        await createRequest(
          alice.cells[0],
          sampleRequest({
            title: "Need Full Stack Developer",
            description: "Looking for someone to build a complete web app",
          }),
          undefined,
          [sharedServiceType.signed_action.hashed.hash]
        );

        await createRequest(
          bob.cells[0],
          sampleRequest({
            title: "React + Node.js Project",
            description: "Need help with React frontend and Node.js backend",
          }),
          undefined,
          [sharedServiceType.signed_action.hashed.hash]
        );

        await createOffer(
          alice.cells[0],
          sampleOffer({
            title: "Full Stack Development Services",
            description: "I can build complete web applications",
          }),
          undefined,
          [sharedServiceType.signed_action.hashed.hash]
        );

        await createOffer(
          bob.cells[0],
          sampleOffer({
            title: "React & Node.js Expert",
            description: "Specialized in React and Node.js development",
          }),
          undefined,
          [sharedServiceType.signed_action.hashed.hash]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test: Get requests by "javascript" tag
        const jsRequests = await getRequestsByTag(alice.cells[0], "javascript");
        assert.lengthOf(
          jsRequests,
          2,
          "Should find 2 requests with 'javascript' tag"
        );

        // Test: Get offers by "javascript" tag
        const jsOffers = await getOffersByTag(alice.cells[0], "javascript");
        assert.lengthOf(
          jsOffers,
          2,
          "Should find 2 offers with 'javascript' tag"
        );

        // Test: Verify both requests and offers can be found with same tag
        const reactRequests = await getRequestsByTag(alice.cells[0], "react");
        const reactOffers = await getOffersByTag(alice.cells[0], "react");

        assert.lengthOf(
          reactRequests,
          2,
          "Should find 2 requests with 'react' tag"
        );
        assert.lengthOf(
          reactOffers,
          2,
          "Should find 2 offers with 'react' tag"
        );

        // Test: Verify that the service types themselves can be found
        const reactServiceTypes = await getServiceTypesByTag(
          alice.cells[0],
          "react"
        );
        assert.lengthOf(
          reactServiceTypes,
          1,
          "Should find 1 service type with 'react' tag"
        );

        const serviceTypeDecoded = decodeRecords<ServiceType>([
          reactServiceTypes[0],
        ])[0];
        assert.equal(serviceTypeDecoded.name, "Full Stack Development");

        // Test: Verify tag discovery across all entities
        const allTags = await getAllServiceTypeTags(alice.cells[0]);
        assert.include(
          allTags,
          "javascript",
          "Tags should include 'javascript'"
        );
        assert.include(allTags, "react", "Tags should include 'react'");
        assert.include(allTags, "nodejs", "Tags should include 'nodejs'");
        assert.include(allTags, "database", "Tags should include 'database'");
        assert.include(allTags, "api", "Tags should include 'api'");
      }
    );
  },
  { timeout: 180000 }
);

// Test for empty results and edge cases
test(
  "Tag-based discovery edge cases",
  async () => {
    await runScenarioWithTwoAgents(
      async (_scenario: Scenario, alice: Player, bob: Player) => {
        // Setup users and admin
        const aliceUser = sampleUser({ name: "Alice" });
        const aliceUserRecord = await createUser(alice.cells[0], aliceUser);
        const bobUser = sampleUser({ name: "Bob" });
        await createUser(bob.cells[0], bobUser);

        await registerNetworkAdministrator(
          alice.cells[0],
          aliceUserRecord.signed_action.hashed.hash,
          [alice.agentPubKey]
        );

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test: Get requests/offers by tag when no service types exist
        const emptyRequests = await getRequestsByTag(
          alice.cells[0],
          "javascript"
        );
        assert.lengthOf(
          emptyRequests,
          0,
          "Should find no requests when no service types exist"
        );

        const emptyOffers = await getOffersByTag(alice.cells[0], "javascript");
        assert.lengthOf(
          emptyOffers,
          0,
          "Should find no offers when no service types exist"
        );

        // Create service type but no requests/offers
        await createServiceType(alice.cells[0], {
          service_type: sampleServiceTypeWithTags("Unused Service", [
            "unused",
            "test",
          ]),
        });

        await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

        // Test: Get requests/offers by tag when service type exists but no entities
        const noRequests = await getRequestsByTag(alice.cells[0], "unused");
        assert.lengthOf(
          noRequests,
          0,
          "Should find no requests when service type exists but no requests created"
        );

        const noOffers = await getOffersByTag(alice.cells[0], "unused");
        assert.lengthOf(
          noOffers,
          0,
          "Should find no offers when service type exists but no offers created"
        );

        // Test: Case sensitivity
        const caseRequests = await getRequestsByTag(alice.cells[0], "UNUSED");
        assert.lengthOf(
          caseRequests,
          0,
          "Should not find requests with different case (case sensitive)"
        );

        // Test: Empty string tag
        const emptyStringRequests = await getRequestsByTag(alice.cells[0], "");
        assert.lengthOf(
          emptyStringRequests,
          0,
          "Should find no requests with empty string tag"
        );

        // Test: Very long tag name
        const longTag = "a".repeat(1000);
        const longTagRequests = await getRequestsByTag(alice.cells[0], longTag);
        assert.lengthOf(
          longTagRequests,
          0,
          "Should handle very long tag names gracefully"
        );
      }
    );
  },
  { timeout: 180000 }
);
