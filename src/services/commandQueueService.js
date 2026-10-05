const { createCommandInstance } = require("../domain/commands/commandSchema");
const { COMMAND_STATUSES } = require("../domain/commands/commandStatus");
const { validateCommand } = require("../domain/commands/commandValidation");
const spacecraftService = require("./spacecraftService");

let commands = [];
let nextSequence = 1;

function enqueue(command) {
  const validation = validateCommand(command);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const queuedCommand = createCommandInstance({
    type: validation.command.type,
    parameters: validation.command.parameters,
    sequence: nextSequence++,
  });

  commands.push(queuedCommand);
  return { success: true, command: cloneCommand(queuedCommand) };
}

function getAll() {
  return commands
    .filter((command) => command.status === COMMAND_STATUSES.QUEUED)
    .map(cloneCommand);
}

function getById(id) {
  const command = commands.find((entry) => entry.id === id);
  return command ? cloneCommand(command) : null;
}

function cancel(id) {
  return updateStatus(id, COMMAND_STATUSES.CANCELLED);
}

function clear() {
  commands = [];
  nextSequence = 1;
}

function markExecuted(id) {
  return updateStatus(id, COMMAND_STATUSES.EXECUTED);
}

function markFailed(id) {
  return updateStatus(id, COMMAND_STATUSES.FAILED);
}

function execute(id) {
  const command = commands.find((entry) => entry.id === id);
  if (!command) {
    return failure("COMMAND_NOT_FOUND", `Command not found: ${id}`);
  }

  if (command.status !== COMMAND_STATUSES.QUEUED) {
    return statusFailure(command);
  }

  const execution = spacecraftService.executeCommand(command);
  const statusUpdate = execution.success ? markExecuted(id) : markFailed(id);

  if (!statusUpdate.success) {
    return statusUpdate;
  }

  return {
    ...execution,
    command: statusUpdate.command,
  };
}

function getSnapshot() {
  return getAll();
}

function updateStatus(id, status) {
  const command = commands.find((entry) => entry.id === id);
  if (!command) {
    return failure("COMMAND_NOT_FOUND", `Command not found: ${id}`);
  }

  if (command.status !== COMMAND_STATUSES.QUEUED) {
    return statusFailure(command);
  }

  command.status = status;
  return { success: true, command: cloneCommand(command) };
}

function statusFailure(command) {
  const errorByStatus = {
    [COMMAND_STATUSES.EXECUTED]: [
      "COMMAND_ALREADY_EXECUTED",
      "Command has already been executed",
    ],
    [COMMAND_STATUSES.CANCELLED]: [
      "COMMAND_ALREADY_CANCELLED",
      "Command has already been cancelled",
    ],
    [COMMAND_STATUSES.FAILED]: [
      "COMMAND_ALREADY_FAILED",
      "Command has already failed",
    ],
  };
  const [code, message] = errorByStatus[command.status] ?? [
    "INVALID_QUEUE_OPERATION",
    `Command cannot be changed from status ${command.status}`,
  ];

  return failure(code, message);
}

function failure(code, message) {
  return { success: false, error: { code, message } };
}

function cloneCommand(command) {
  return structuredClone(command);
}

module.exports = {
  enqueue,
  getAll,
  getById,
  getSnapshot,
  cancel,
  clear,
  markExecuted,
  markFailed,
  execute,
};