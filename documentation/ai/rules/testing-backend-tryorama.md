# Testing: Backend with Tryorama

## Holochain Multi-Agent Testing

```rust
#[tokio::test(flavor = "multi_thread")]
async fn test_service_type_workflow() -> anyhow::Result<()> {
    let (conductor, _agent, cell) = setup_conductor_test().await?;

    let service_type_input = CreateServiceTypeInput {
        name: "Test Service".to_string(),
        description: Some("Test description".to_string()),
        tags: vec!["test".to_string(), "service".to_string()],
    };

    let service_type_hash: ActionHash = conductor
        .call(
            &cell.zome("service_types_coordinator"),
            "create_service_type",
            service_type_input.clone(),
        )
        .await?;

    assert!(!service_type_hash.get_raw_39().is_empty());

    let retrieved_service_type: Option<Record> = conductor
        .call(
            &cell.zome("service_types_coordinator"),
            "get_service_type",
            service_type_hash.clone(),
        )
        .await?;

    assert!(retrieved_service_type.is_some());
    let record = retrieved_service_type.unwrap();
    let entry: ServiceType = record.entry().try_into()?;
    assert_eq!(entry.name, service_type_input.name);
    assert_eq!(entry.description, service_type_input.description);
    assert_eq!(entry.tags, service_type_input.tags);

    Ok(())
}
```

## Multi-Agent Scenarios

```rust
#[tokio::test(flavor = "multi_thread")]
async fn test_multi_agent_service_types() -> anyhow::Result<()> {
    let (conductor, agent1, agent2) = setup_multi_agent_test(2).await?;

    let service_type_hash = create_service_type_as_agent(&conductor, &agent1,
        "Shared Service", "Available to all agents").await?;

    let retrieved = get_service_type_as_agent(&conductor, &agent2, service_type_hash).await?;
    assert!(retrieved.is_some());

    wait_for_integration(&conductor, Duration::from_secs(5)).await?;

    let all_types_agent1 = get_all_service_types_as_agent(&conductor, &agent1).await?;
    let all_types_agent2 = get_all_service_types_as_agent(&conductor, &agent2).await?;

    assert_eq!(all_types_agent1.len(), all_types_agent2.len());
    assert!(all_types_agent1.len() > 0);

    Ok(())
}
```

## Zome Testing Patterns

```rust
mod service_types_tests {
    use super::*;

    #[tokio::test]
    async fn test_create_service_type_validation() -> anyhow::Result<()> {
        let (conductor, _agent, cell) = setup_conductor_test().await?;

        let invalid_input = CreateServiceTypeInput {
            name: "".to_string(),
            description: None,
            tags: vec![],
        };

        let result: Result<ActionHash, _> = conductor
            .call(
                &cell.zome("service_types_coordinator"),
                "create_service_type",
                invalid_input,
            )
            .await;

        assert!(result.is_err());
        Ok(())
    }

    #[tokio::test]
    async fn test_service_type_tags_indexing() -> anyhow::Result<()> {
        let (conductor, _agent, cell) = setup_conductor_test().await?;

        let service_type1 = create_test_service_type(&conductor, &cell,
            "Service 1", vec!["web", "development"]).await?;
        let service_type2 = create_test_service_type(&conductor, &cell,
            "Service 2", vec!["web", "design"]).await?;

        let web_services: Vec<ActionHash> = conductor
            .call(
                &cell.zome("service_types_coordinator"),
                "get_service_types_by_tag",
                "web".to_string(),
            )
            .await?;

        assert_eq!(web_services.len(), 2);
        assert!(web_services.contains(&service_type1));
        assert!(web_services.contains(&service_type2));
        Ok(())
    }
}
```
