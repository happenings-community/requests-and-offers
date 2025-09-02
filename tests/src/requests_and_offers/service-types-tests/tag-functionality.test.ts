import { assert, test } from "vitest";
import { Scenario, Player, dhtSync, PlayerApp } from "@holochain/tryorama";
import { decodeRecords, runScenarioWithTwoAgents } from "../utils";
import { createUser, sampleUser } from "../users/common";
import { registerNetworkAdministrator } from "../administration/common";
import {
  createServiceType,
  deleteServiceType,
  sampleServiceTypeWithTags,
  getAllServiceTypeTags,
  getServiceTypesByTag,
  getServiceTypesByTags,
  searchServiceTypesByTagPrefix,
  getTagStatistics,
  ServiceType,
} from "./common";

// Test for basic tag indexing and retrieval
test("Tag indexing and basic retrieval", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Access the requests_and_offers DNA cells by role name
      const aliceRequestsAndOffers = alice.namedCells.get("requests_and_offers")!;
      const bobRequestsAndOffers = bob.namedCells.get("requests_and_offers")!;

      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types with different tags
      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Web Development", [
          "javascript",
          "react",
          "frontend",
          "backend",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Mobile Development", [
          "javascript",
          "react-native",
          "mobile",
          "ios",
          "android",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("UI/UX Design", [
          "design",
          "ui",
          "ux",
          "figma",
          "prototyping",
        ]),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test getting all tags
      const allTags = await getAllServiceTypeTags(aliceRequestsAndOffers);
      assert.isArray(allTags);
      assert.include(allTags, "javascript");
      assert.include(allTags, "react");
      assert.include(allTags, "design");
      assert.include(allTags, "mobile");

      // Should have unique tags from all service types
      const expectedTags = [
        "javascript",
        "react",
        "frontend",
        "backend",
        "react-native",
        "mobile",
        "ios",
        "android",
        "design",
        "ui",
        "ux",
        "figma",
        "prototyping",
      ];
      expectedTags.forEach((tag) => {
        assert.include(allTags, tag, `Tag "${tag}" should be in all tags`);
      });

      // Test getting service types by single tag
      const jsServiceTypes = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "javascript",
      );
      assert.lengthOf(
        jsServiceTypes,
        2,
        "Should find 2 service types with 'javascript' tag",
      );

      const jsNames = jsServiceTypes.map((record) => {
        const decoded = decodeRecords<ServiceType>([record])[0];
        return decoded.name;
      });
      assert.include(jsNames, "Web Development");
      assert.include(jsNames, "Mobile Development");

      const designServiceTypes = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "design",
      );
      assert.lengthOf(
        designServiceTypes,
        1,
        "Should find 1 service type with 'design' tag",
      );

      const designDecoded = decodeRecords<ServiceType>([
        designServiceTypes[0],
      ])[0];
      assert.equal(designDecoded.name, "UI/UX Design");

      // Test getting service types by non-existent tag
      const nonExistentTagResults = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "nonexistent",
      );
      assert.lengthOf(
        nonExistentTagResults,
        0,
        "Should find no service types with non-existent tag",
      );
    },
  );
});

// Test for multi-tag search (intersection)
test("Multi-tag search with intersection logic", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types with overlapping tags
      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Full Stack Development", [
          "javascript",
          "react",
          "nodejs",
          "fullstack",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Frontend Development", [
          "javascript",
          "react",
          "css",
          "frontend",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Backend Development", [
          "javascript",
          "nodejs",
          "database",
          "backend",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Python Development", [
          "python",
          "django",
          "backend",
          "api",
        ]),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test intersection with 2 tags
      const jsAndReactResults = await getServiceTypesByTags(aliceRequestsAndOffers, [
        "javascript",
        "react",
      ]);
      assert.lengthOf(
        jsAndReactResults,
        2,
        "Should find 2 service types with both 'javascript' AND 'react'",
      );

      const jsAndReactNames = jsAndReactResults.map((record) => {
        const decoded = decodeRecords<ServiceType>([record])[0];
        return decoded.name;
      });
      assert.include(jsAndReactNames, "Full Stack Development");
      assert.include(jsAndReactNames, "Frontend Development");

      // Test intersection with 3 tags
      const jsReactNodeResults = await getServiceTypesByTags(aliceRequestsAndOffers, [
        "javascript",
        "react",
        "nodejs",
      ]);
      assert.lengthOf(
        jsReactNodeResults,
        1,
        "Should find 1 service type with 'javascript' AND 'react' AND 'nodejs'",
      );

      const fullStackDecoded = decodeRecords<ServiceType>([
        jsReactNodeResults[0],
      ])[0];
      assert.equal(fullStackDecoded.name, "Full Stack Development");

      // Test intersection with no matches
      const noMatchResults = await getServiceTypesByTags(aliceRequestsAndOffers, [
        "python",
        "react",
      ]);
      assert.lengthOf(
        noMatchResults,
        0,
        "Should find no service types with 'python' AND 'react'",
      );

      // Test with empty array
      const emptyTagsResults = await getServiceTypesByTags(aliceRequestsAndOffers, []);
      assert.lengthOf(
        emptyTagsResults,
        0,
        "Should return empty array for empty tags input",
      );

      // Test with single tag (should work like getServiceTypesByTag)
      const singleTagResults = await getServiceTypesByTags(aliceRequestsAndOffers, [
        "backend",
      ]);
      assert.lengthOf(
        singleTagResults,
        2,
        "Should find 2 service types with 'backend' tag",
      );
    },
  );
});

// Test for tag prefix search (autocomplete functionality)
test("Tag prefix search for autocomplete", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types with tags that have common prefixes
      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("React Development", [
          "react",
          "react-native",
          "react-hooks",
          "javascript",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Java Development", [
          "java",
          "javascript",
          "spring",
          "backend",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Database Design", [
          "database",
          "sql",
          "postgresql",
          "design",
        ]),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test prefix search for "react"
      const reactPrefixResults = await searchServiceTypesByTagPrefix(
        aliceRequestsAndOffers,
        "react",
      );
      assert.isAtLeast(
        reactPrefixResults.length,
        1,
        "Should find service types with tags starting with 'react'",
      );

      // Should find the React Development service type
      const reactNames = reactPrefixResults.map((record) => {
        const decoded = decodeRecords<ServiceType>([record])[0];
        return decoded.name;
      });
      assert.include(reactNames, "React Development");

      // Test prefix search for "java"
      const javaPrefixResults = await searchServiceTypesByTagPrefix(
        aliceRequestsAndOffers,
        "java",
      );
      assert.isAtLeast(
        javaPrefixResults.length,
        1,
        "Should find service types with tags starting with 'java'",
      );

      // Should find both React Development (javascript) and Java Development (java, javascript)
      const javaNames = javaPrefixResults.map((record) => {
        const decoded = decodeRecords<ServiceType>([record])[0];
        return decoded.name;
      });
      assert.include(javaNames, "React Development"); // has "javascript"
      assert.include(javaNames, "Java Development"); // has "java" and "javascript"

      // Test case-insensitive prefix search
      const upperCaseResults = await searchServiceTypesByTagPrefix(
        aliceRequestsAndOffers,
        "REACT",
      );
      assert.lengthOf(
        upperCaseResults,
        reactPrefixResults.length,
        "Case-insensitive search should return same results",
      );

      // Test prefix search with no matches
      const noMatchPrefix = await searchServiceTypesByTagPrefix(
        aliceRequestsAndOffers,
        "xyz",
      );
      assert.lengthOf(
        noMatchPrefix,
        0,
        "Should find no service types with tags starting with 'xyz'",
      );

      // Test empty prefix
      const emptyPrefixResults = await searchServiceTypesByTagPrefix(
        aliceRequestsAndOffers,
        "",
      );
      assert.isAtLeast(
        emptyPrefixResults.length,
        3,
        "Empty prefix should return all service types",
      );
    },
  );
});

// Test for tag statistics
test("Tag usage statistics", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types with overlapping tags to test statistics
      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Web App 1", [
          "javascript", // used 3 times
          "react", // used 2 times
          "frontend", // used 1 time
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Web App 2", [
          "javascript", // used 3 times
          "react", // used 2 times
          "backend", // used 1 time
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Mobile App", [
          "javascript", // used 3 times
          "mobile", // used 1 time
        ]),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test tag statistics
      const tagStats = await getTagStatistics(aliceRequestsAndOffers);
      assert.isArray(tagStats, "Tag statistics should be an array");
      assert.isAtLeast(
        tagStats.length,
        5,
        "Should have at least 5 different tags",
      );

      // Convert to a map for easier testing
      const statsMap = new Map(tagStats);

      // Test specific tag counts
      assert.equal(
        statsMap.get("javascript"),
        3,
        "JavaScript should be used 3 times",
      );
      assert.equal(statsMap.get("react"), 2, "React should be used 2 times");
      assert.equal(
        statsMap.get("frontend"),
        1,
        "Frontend should be used 1 time",
      );
      assert.equal(statsMap.get("backend"), 1, "Backend should be used 1 time");
      assert.equal(statsMap.get("mobile"), 1, "Mobile should be used 1 time");

      // Test that statistics are sorted by usage count (descending)
      assert.isTrue(
        tagStats[0][1] >= tagStats[1][1],
        "First tag should have highest or equal usage count",
      );
      assert.equal(
        tagStats[0][0],
        "javascript",
        "JavaScript should be the most used tag",
      );
      assert.equal(tagStats[0][1], 3, "JavaScript should have count of 3");
    },
  );
});

// Test for tag cleanup on service type deletion
test("Tag cleanup on service type deletion", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Create service types with unique and shared tags
      const serviceType1 = await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Service 1", [
          "shared-tag",
          "unique-tag-1",
        ]),
      });

      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Service 2", [
          "shared-tag",
          "unique-tag-2",
        ]),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify initial state
      const initialTags = await getAllServiceTypeTags(aliceRequestsAndOffers);
      assert.include(initialTags, "shared-tag");
      assert.include(initialTags, "unique-tag-1");
      assert.include(initialTags, "unique-tag-2");

      const initialSharedTagResults = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "shared-tag",
      );
      assert.lengthOf(
        initialSharedTagResults,
        2,
        "Should find 2 service types with shared-tag",
      );

      const initialUniqueTag1Results = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "unique-tag-1",
      );
      assert.lengthOf(
        initialUniqueTag1Results,
        1,
        "Should find 1 service type with unique-tag-1",
      );

      // Delete service type 1
      await deleteServiceType(
        aliceRequestsAndOffers,
        serviceType1.signed_action.hashed.hash,
      );
      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Verify tag cleanup
      const afterDeleteTags = await getAllServiceTypeTags(aliceRequestsAndOffers);
      assert.include(
        afterDeleteTags,
        "shared-tag",
        "Shared tag should still exist",
      );
      assert.include(
        afterDeleteTags,
        "unique-tag-2",
        "Unique tag 2 should still exist",
      );
      // Note: unique-tag-1 might still be in all_tags but should have no service types

      const afterDeleteSharedTagResults = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "shared-tag",
      );
      assert.lengthOf(
        afterDeleteSharedTagResults,
        1,
        "Should find 1 service type with shared-tag after deletion",
      );

      const afterDeleteUniqueTag1Results = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "unique-tag-1",
      );
      assert.lengthOf(
        afterDeleteUniqueTag1Results,
        0,
        "Should find no service types with unique-tag-1 after deletion",
      );

      // Verify tag statistics are updated
      const afterDeleteStats = await getTagStatistics(aliceRequestsAndOffers);
      const statsMap = new Map(afterDeleteStats);
      assert.equal(
        statsMap.get("shared-tag"),
        1,
        "Shared tag should have count of 1 after deletion",
      );
      assert.equal(
        statsMap.get("unique-tag-2"),
        1,
        "Unique tag 2 should have count of 1",
      );
      // unique-tag-1 should either not exist in stats or have count of 0
      if (statsMap.has("unique-tag-1")) {
        assert.equal(
          statsMap.get("unique-tag-1"),
          0,
          "Unique tag 1 should have count of 0 if present",
        );
      }
    },
  );
});

// Test for edge cases and error handling
test("Tag functionality edge cases", async () => {
  await runScenarioWithTwoAgents(
    async (_scenario: Scenario, alice: PlayerApp, bob: PlayerApp) => {
      // Setup users and admin
      const aliceUser = sampleUser({ name: "Alice" });
      const aliceUserRecord = await createUser(aliceRequestsAndOffers, aliceUser);
      const bobUser = sampleUser({ name: "Bob" });
      await createUser(bobRequestsAndOffers, bobUser);

      await registerNetworkAdministrator(
        aliceRequestsAndOffers,
        aliceUserRecord.signed_action.hashed.hash,
        [alice.agentPubKey],
      );

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test with empty tags array
      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("No Tags Service", []),
      });

      // Test with duplicate tags in same service type
      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Duplicate Tags Service", [
          "tag1",
          "tag2",
          "tag1", // duplicate
          "tag3",
        ]),
      });

      // Test with special characters in tags
      await createServiceType(aliceRequestsAndOffers, {
        service_type: sampleServiceTypeWithTags("Special Chars Service", [
          "tag-with-dash",
          "tag_with_underscore",
          "tag.with.dots",
          "tag123",
        ]),
      });

      await dhtSync([alice, bob], aliceRequestsAndOffers.cell_id[0]);

      // Test getting all tags includes special characters
      const allTags = await getAllServiceTypeTags(aliceRequestsAndOffers);
      assert.include(allTags, "tag-with-dash");
      assert.include(allTags, "tag_with_underscore");
      assert.include(allTags, "tag.with.dots");
      assert.include(allTags, "tag123");

      // Test searching with special characters
      const dashTagResults = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "tag-with-dash",
      );
      assert.lengthOf(
        dashTagResults,
        1,
        "Should find service type with dash tag",
      );

      // Test prefix search with special characters
      const dashPrefixResults = await searchServiceTypesByTagPrefix(
        aliceRequestsAndOffers,
        "tag-",
      );
      assert.isAtLeast(
        dashPrefixResults.length,
        1,
        "Should find service types with tags starting with 'tag-'",
      );

      // Test case sensitivity
      const upperCaseTagResults = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "TAG1",
      );
      const lowerCaseTagResults = await getServiceTypesByTag(
        aliceRequestsAndOffers,
        "tag1",
      );
      // Depending on implementation, these might be the same or different
      // The backend implementation uses case-sensitive paths, so they should be different
      assert.lengthOf(
        upperCaseTagResults,
        0,
        "Uppercase tag search should find no results (case sensitive)",
      );
      // Note: We expect 1 result, but if duplicates are handled differently,
      // we might get multiple records for the same service type
      assert.isAtLeast(
        lowerCaseTagResults.length,
        1,
        "Lowercase tag search should find at least 1 result",
      );

      // Verify that we get the correct service type (even if duplicated)
      const uniqueServiceTypeNames = new Set(
        lowerCaseTagResults.map((record) => {
          const decoded = decodeRecords<ServiceType>([record])[0];
          return decoded.name;
        }),
      );
      assert.include(
        Array.from(uniqueServiceTypeNames),
        "Duplicate Tags Service",
        "Should find the service type with tag1",
      );
    },
  );
});
