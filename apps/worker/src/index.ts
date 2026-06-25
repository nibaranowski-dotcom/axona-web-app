/**
 * @axona/worker — long-lived Node process running BullMQ agent + workflow runners.
 *
 * Connects to Redis (stood up in FND.3). The real queues, AgentRun execution,
 * and the workflow DAG engine land in E3 (ART.* / WF.1). Stubbed at scaffold so
 * the workspace is coherent and typechecks.
 */
function main(): void {
  console.log("[axona-worker] scaffold ready — queues wired in WF.1");
}

main();
