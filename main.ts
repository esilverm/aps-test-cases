// @ts-nocheck - Still developing the code out and will remove later
import { parse } from "https://deno.land/std/flags/mod.ts";
import * as path from "https://deno.land/std/path/mod.ts";
import { copy, ensureDir, exists } from "https://deno.land/std/fs/mod.ts";
import { bold, green, red } from "https://deno.land/std/fmt/colors.ts";
import { readLines } from "https://deno.land/std/io/mod.ts";


const HELP_TEXT = `
Hi! This is a test runner for APS. The arguments are:

./run_tests <source_file> <testPath> [--debug] [--help] [-h]

  source_file   The source file to compile.
  testPath     The path for test data. It can be a folder or file.
                If a test case file is named \`test-case-1\`, this script will look
                for a file in the same folder with the name \`test-case-1-ans\`
  --help,-h     OPTIONAL. Show this message.
  --debug       OPTIONAL. Show debug information.

Please note that this program can't test for presentation errors! However, it
will tell you what the output should have been, so that should help.
`;

const { args } = Deno;
const { _: files, ...parsedArgs } = parse(args);
const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();
const debuginfo = (message) => console.info(bold("DEBUG") + `: ${message}`);

if ("help" in parsedArgs || "h" in parsedArgs) {
  console.log(HELP_TEXT);
  Deno.exit(0);
}

if (files.length < 1) {
  console.error(
    bold("Error: No program file was given. (should be first argument)"),
  );
  Deno.exit(1);
}

// Handle build file paths
const { name: filename, ext } = path.parse(files[0]);
const filePath = await Deno.realPath(files[0]);
const projectDir = path.dirname(path.fromFileUrl(import.meta.url));
const binDir = path.join(projectDir, ".build");
const outputFilename = ext === ".java" ? "Main.java" : `main${ext}`;
const outputFile = path.join(binDir, filename, outputFilename);
const classpath = path.join(binDir, filename);
const binaryFile = path.join(binDir, filename, "out");
const testPath = files.length > 1 ? await Deno.realPath(files[1]) : null;

if ("debug" in parsedArgs) {
  debuginfo(`Project directory: ${projectDir}`);
  debuginfo(` Output directory: ${binDir}`);
  debuginfo(`      Output file: ${outputFile}`);

  debuginfo(`        Classpath: ${classpath}`);
  debuginfo(`      Binary file: ${binaryFile}`);

  debuginfo(`        File path: ${filePath}`);
  debuginfo(`        File name: ${filename}`);
  debuginfo(`        Extension: ${ext}`);
}

// Prepare input files
await ensureDir(path.dirname(outputFile));
Promise.all([
  copy(filePath, outputFile, { overwrite: true }),
  copy(filePath, path.join(binDir, outputFilename), { overwrite: true }),
]);

// Compile code using the commands as posted by Joanna.
console.log("Compiling code...");
let command: string[];
if (ext === ".java") {
  command = ["javac", "-encoding", "UTF8", outputFile, "-d", classpath];
} else if (ext === ".cpp") {
  command = ["g++", "-O2", outputFile, "-o", binaryFile];
} else if (ext === ".c") {
  command = ["gcc", "-O2", outputFile, "-o", binaryFile];
}

const compile = Deno.run({
  cmd: command,
  stdout: "piped",
  stderr: "piped",
});
const { code: compileCode } = await compile.status();

const compileOutput = await compile.output();
const compileOutStr = decoder.decode(compileOutput);
const compileError = await compile.stderrOutput();
const compileErrorStr = decoder.decode(compileError);
compile.close();

if (compileCode !== 0) {
  console.log(red(bold(" ERROR.\n")));
  if (compileOutStr !== "") {
    console.log(compileOutStr);
  }
  if (compileErrorStr !== "") {
    console.log(compileErrorStr);
  }
  Deno.exit(1);
}

console.log(bold("Done."));
if (compileOutStr !== "") {
  console.log(compileOutStr);
}
if (compileErrorStr !== "") {
  console.log(compileErrorStr);
}

// Prepare running command
command = ext === ".java"
  ? ["java", "-classpath", classpath, "Main"]
  : [binaryFile];

if ("debug" in parsedArgs) {
  debuginfo(`Command is: ${command.join(" ")}`);
}

if (testPath === null) {
  console.log("Input file: stdin");
  console.log("Use Ctrl-D to end input (Ctrl-Z + Enter on Windows)");
  const tempPath = path.join(binDir, ".tmp");

  let txt: string = "";
  for await (let line of readLines(Deno.stdin)) {
    txt += "\n" + line;
  }

  await Deno.writeTextFile(tempPath);

  const { 
    answer, 
    err, 
    success, 
    timeElapsed 
  } = await runCommand(command, encoder.encode(txt));

  console.log(`\nProgram had output:\n${bold(answer)}`);
  if (err) {
    console.log(`with stderr: ${red(err)}`);
  }
  console.log(`...and ran in ${bold(timeElapsed.toFixed(9))} seconds\n`);

  if (!success) {
    Deno.exit(1);
  }

  let saveFile: string | null;

  while (true) {
    const saveRun = confirm("Save this run as a test case?");

    if (!saveRun) {
      Deno.exit(0);
    }
  
    saveFile = prompt("Where should the test case be stored?");
  
    if (!await exists(saveFile.trim())) {
      console.log("Error: file does not exist. Exiting...");
      Deno.exit(0);
    }

    const saveContinue = confirm("Test case already exists, continue?");
    
    if (saveContinue) {
      break;
    }
  }

  const desc = prompt("Please create a description for this test case:");

  const ansFileTxt = `
---
  description: ${desc.trim()}
---
${answer.trim()}
`

  await ensureDir(path.dirname(saveFile));
  
  Deno.writeTextFile(saveFile, txt.trim());
  Deno.writeTextFile(saveFile + '-ans', `${ansFileTxt.trim()}\n`);

  console.log(`Test case answer was stored at: ${saveFile}`);
} else if (!Deno.lstatSync(testPath).isFile) {
  if ("debug" in parsedArgs) {
    debuginfo("Input folder: ", testPath);
  }
  const passing = [];
  const failing = [];

  for await (const dirEntry of Deno.readDir(testPath)) {
    if (dirEntry.name.endsWith("ans")) {
      continue;
    }
    if (dirEntry.name.includes(".")) {
      console.log(`Skipping file ${dirEntry} because it has an extension.`);
      continue;
    }

    if ("debug" in parsedArgs) {
      debuginfo(`Found input file: ${dirEntry.name}`);
    }
    if (await testCommand(command, path.join(testPath, dirEntry.name))) {
      passing.push(dirEntry.name);
    } else {
      failing.push(dirEntry.name);
    }
  }

  console.log();
  console.log(`Passed test cases: ${passing.join(", ") || "None :("}`);
  console.log(`Failed test cases: ${failing.join(", ") || "None!"}`);
} else {
  if ("debug" in parsedArgs) {
    debuginfo(`Input file: ${testPath}`);
  }
  testCommand(command, testPath);
}

async function testCommand(command, testFile): Promise<boolean> {
  const data = Deno.readFileSync(testFile);
  const { answer, err, success, timeElapsed } = await runCommand(command, data);

  // look for answer file
  if (!await exists(testFile + "-ans")) {
    console.info("Couldn't find file.");
    // Print output of program regardless
    return success;
  }

  const correctAnswer = Deno.readFileSync(testFile + "-ans");

  const { description, answer: parsedCorrectAnswer } = parseAnswerFiles(
    decoder.decode(correctAnswer),
  );

  if (answer === parsedCorrectAnswer) {
    if (timeElapsed > 5) {
      console.log(
        `\n${red("✘")} Test case \`${bold(path.basename(testFile))}\` ${
          red("timed out")
        } but answer was ${green("correct")}`,
      );
      return false;
    }

    console.log(
      `\n${green("✔")} Test case \`${
        bold(path.basename(testFile))
      }\` passed in ${bold(timeElapsed.toFixed(9))} seconds`,
    );
    return true;
  } else {
    if (timeElapsed > 5) {
      console.log(
        `\n${red("✘")} Test case \`${bold(path.basename(testFile))}\` ${
          red("timed out")
        } and answer was ${red("incorrect")}`,
      );
      return false;
    }

    console.log(
      `\n${red("✘")} Test case \`${bold(path.basename(testFile))}\` ${
        red("failed")
      }`,
    );
    const lines = decoder.decode(data).split("\n");
    console.log(
      `${bold("with input:\n")}${
        lines.length > 100
          ? lines.slice(1, 50).join("\n") + "..." +
            lines.slice(lines.length - 50, 50)
          : decoder.decode(data)
      }`,
    );
    console.log(`with output: \n${bold(answer)}`);
    console.log(`when correct output was: \n${bold(parsedCorrectAnswer)}`);

    if (err !== "") {
      console.log(`with stderr: ${red(err)}`);
    }
    if (description !== "") {
      console.log(`Test Description: ${bold(description)}`);
    }

    return false;
  }
}

async function runCommand(command: string[], data) {
  const start = performance.now();
  const cmd = Deno.run({
    cmd: command,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  if (!cmd.stdin) throw Error();

  await cmd.stdin.write(data);
  await cmd.stdin.close();

  const { code } = await cmd.status();
  const end = performance.now();
  const output = await cmd.output();
  const outStr = decoder.decode(output);
  const error = await cmd.stderrOutput();
  const errorStr = decoder.decode(error);
  cmd.close();
  return {
    answer: outStr.substr(0, outStr.length - 1),
    err: errorStr,
    success: code == 0,
    timeElapsed: (end - start) / 1000,
  };
}

function parseAnswerFiles(filecontent: string) {
  const [metadata] = filecontent.match(/---[\d\D]*?---/) ?? [""];

  if (metadata === "") {
    return { description: "", answer: filecontent };
  }

  const parsed = metadata.replace(/---/g, "").trim();
  const answer = filecontent.replace(metadata, "").trim();
  return {
    description: parsed.match(/.*description:\s*([^\n\r]*)/)[1],
    answer,
  };
}
