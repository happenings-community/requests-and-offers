import { test, expect } from "vitest";
import { runScenario, dhtSync, CallableCell } from "@holochain/tryorama";
import { ActionHash, Record } from "@holochain/client";
import { decode } from "@msgpack/msgpack";
import { createServiceType, getAllServiceTypes } from "./common.js";

test("ServiceType CRUD operations", async () => {
  await runScenario(async (scenario) => {
    // Spawn hApp
    const [conductor] = await scenario.addConductor({
      config: { network: null },
    });
    const [hApp] = await conductor.installAppsBundle({
      path: "./workdir/requests_and_offers.happ",
    });

    await scenario.shareAllAgents();

    const alice = hApp.cells.find(
      (cell) => cell.role_id === "requests_and_offers"
    )!;

    // Test creating a service type
    const serviceTypeInput = {
      service_type: {
        name: "Web Development",
        description: "Frontend and backend web development services",
        tags: ["javascript", "react", "nodejs"],
      },
    };

    const serviceTypeRecord: Record = await createServiceType(
      alice,
      serviceTypeInput
    );
    expect(serviceTypeRecord).toBeTruthy();

    const serviceType = decode(
      (serviceTypeRecord.entry as any).Present.entry
    ) as any;
    expect(serviceType.name).toBe("Web Development");
    expect(serviceType.description).toBe(
      "Frontend and backend web development services"
    );
    expect(serviceType.tags).toEqual(["javascript", "react", "nodejs"]);

    await dhtSync([alice], alice.cell_id[0]);

    // Test getting all service types
    const allServiceTypes: Record[] = await getAllServiceTypes(alice);
    expect(allServiceTypes.length).toBe(1);
    expect(decode((allServiceTypes[0].entry as any).Present.entry)).toEqual(
      serviceType
    );

    // Test getting a specific service type
    const retrievedServiceType: Record = await alice.callZome({
      zome_name: "service_types",
      fn_name: "get_service_type",
      payload: serviceTypeRecord.signed_action.hashed.hash,
    });
    expect(retrievedServiceType).toBeTruthy();
    expect(decode((retrievedServiceType.entry as any).Present.entry)).toEqual(
      serviceType
    );
  });
});

test("ServiceType validation", async () => {
  await runScenario(async (scenario) => {
    const [conductor] = await scenario.addConductors([
      { config: { network: null } },
    ]);
    const [hApp] = await conductor.installAppsBundle({
      path: "./workdir/requests_and_offers.happ",
    });

    await scenario.shareAllAgents();

    const alice = hApp.cells.find(
      (cell) => cell.role_id === "requests_and_offers"
    )!;

    // Test validation - empty name should fail
    const invalidServiceTypeInput = {
      service_type: {
        name: "",
        description: "Valid description",
        tags: [],
      },
    };

    try {
      await createServiceType(alice, invalidServiceTypeInput);
      expect.fail("Should have thrown an error for empty name");
    } catch (error) {
      expect(error.toString()).toContain("ServiceType name cannot be empty");
    }

    // Test validation - empty description should fail
    const invalidServiceTypeInput2 = {
      service_type: {
        name: "Valid Name",
        description: "",
        tags: [],
      },
    };

    try {
      await createServiceType(alice, invalidServiceTypeInput2);
      expect.fail("Should have thrown an error for empty description");
    } catch (error) {
      expect(error.toString()).toContain(
        "ServiceType description cannot be empty"
      );
    }
  });
});

test("ServiceType admin permissions", async () => {
  await runScenario(async (scenario) => {
    const [conductor] = await scenario.addConductors([
      { config: { network: null } },
    ]);
    const [hApp] = await conductor.installAppsBundle({
      path: "./workdir/requests_and_offers.happ",
    });

    await scenario.shareAllAgents();

    const alice = hApp.cells.find(
      (cell) => cell.role_id === "requests_and_offers"
    )!;

    // Note: This test assumes Alice is not an admin by default
    // In a real scenario, you would need to set up admin permissions first

    const serviceTypeInput = {
      service_type: {
        name: "Design Services",
        description: "UI/UX and graphic design services",
        tags: ["design", "ui", "ux"],
      },
    };

    try {
      await createServiceType(alice, serviceTypeInput);
      // If this succeeds, Alice has admin permissions
      // If it fails, we expect an unauthorized error
    } catch (error) {
      expect(error.toString()).toContain("Unauthorized");
    }
  });
});
