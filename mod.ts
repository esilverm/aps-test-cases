// @ts-nocheck
import { parse } from "https://deno.land/std@0.85.0/flags/mod.ts";
import * as path from "https://deno.land/std@0.85.0/path/mod.ts";
import { ensureDir, copy, exists } from "https://deno.land/std@0.85.0/fs/mod.ts";
import { green, red, bold } from "https://deno.land/std/fmt/colors.ts";


/***
 * Flags:
 * deno run --allow-run mod.ts <source_file> <test_path> [--debug] [--help] [-h]
 * --debug: show debug information
 * -h, --help: show this message
 * 
 */

const HELP_TEXT = `
Hi! This is a test runner for APS. The arguments are:

deno run mod.ts <source_file> <test_path> [--debug] [--help] [-h]

  source_file   The source file to compile.
  test_path     The path for test data. It can be a folder or file.
                If a test case file is named \`test-case-1\`, this script will look
                for a file in the same folder with the name \`test-case-1-ans\`
  --help,-h     OPTIONAL. Show this message.
  --debug       OPTIONAL. Show debug information.

Please note that this program can't test for presentation errors! However, it
will tell you what the output should have been, so that should help.
`


const { args } = Deno;
const { _: files, ...parsedArgs } = parse(args);
const decoder = new TextDecoder("utf-8");
const debuginfo = (message) => console.info(bold("DEBUG") + `: ${message}`);

if ("help" in parsedArgs || "h" in parsedArgs) {
  console.log(HELP_TEXT);
  Deno.exit(0);
}

if (files.length < 1) {
  console.error(bold("Error: No program file was given. (should be first argument)"));
  Deno.exit(1);
}


// Handle build file paths and 
const { name: filename, ext} = path.parse(files[0]);
const file_path = await Deno.realPath(files[0]);
const project_dir = path.dirname(path.fromFileUrl(import.meta.url));
const bin_dir = path.join(project_dir, ".build");
const output_filename = ext === '.java' ? "Main.java" : `main${ext}`;
const output_file = path.join(bin_dir, filename, output_filename);
const classpath = path.join(bin_dir, filename);
const binary_file = path.join(bin_dir, filename, "out");
const test_path = files.length > 1 ? await Deno.realPath(files[1]) : null;


if ("debug" in parsedArgs) {
  debuginfo(`Project directory: ${project_dir}`);
  debuginfo(` Output directory: ${bin_dir}`);
  debuginfo(`      Output file: ${output_file}`);

  debuginfo(`        Classpath: ${classpath}`);
  debuginfo(`      Binary file: ${binary_file}`);

  debuginfo(`        File path: ${file_path}`);
  debuginfo(`        File name: ${filename}`);
  debuginfo(`        Extension: ${ext}`);
}

// Prepare input files
await ensureDir(path.dirname(output_file));
Promise.all([
  copy(file_path, output_file, {overwrite: true}),
  copy(file_path, path.join(bin_dir, output_filename), {overwrite: true}),
])

// Compile code using the commands as posted by Joanna.
console.log("Compiling code...")
let command: string[];
if (ext === ".java") {
  command = ["javac", "-encoding", "UTF8", output_file, "-d", classpath];
} else if (ext === ".cpp") {
  command = ["g++", "-O2", output_file, "-o", binary_file];
} else if (ext === '.c') {
  command = ["gcc", "-O2", output_file, "-o", binary_file];

}

const compile = Deno.run({
  cmd: command,
  stdout: "piped",
  stderr: "piped"
})
const { code: compile_code } = await compile.status();

const compile_output = await compile.output();
const compile_outStr = new TextDecoder().decode(compile_output)
const compile_error = await compile.stderrOutput();
const compile_errorStr = new TextDecoder().decode(compile_error); 
compile.close();

if (compile_code !== 0) {
  console.log(red(bold(" ERROR.\n")));
  if (compile_outStr !== "") {
    console.log(compile_outStr);
  }
  if (compile_errorStr !== "") {
    console.log(compile_errorStr);
  }
  Deno.exit(1);
}

console.log(bold("Done."));
if (compile_outStr !== "") {
  console.log(compile_outStr);
}
if (compile_errorStr !== "") {
  console.log(compile_errorStr);
}

// Prepare running command
command = ext === ".java" ? ["java", "-classpath", classpath, "Main"] : [binary_file];

if ("debug" in parsedArgs) {
  debuginfo(`Command is: ${command.join(" ")}`);
}

// TODO : Handle No Test Data and if test_dir is not a dir
if (test_path === null) {
  console.log("You need to enter a test_path");
  Deno.exit(0);
} else {
  if ("debug" in parsedArgs) {
    debug("Input folder: ", test_path);
  }
  const passing = [];
  const failing = [];

  for await (const dirEntry of Deno.readDir(test_path)) {
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
    if (await test_command(command, path.join(test_path, dirEntry.name), true)) {
      passing.push(dirEntry.name);
    } else {
      failing.push(dirEntry.name)
    }
  }

  console.log();
  console.log(`Passed test cases: ${passing.join(", ")}`);
  console.log(`Failed test cases: ${failing.join(", ")}`);
}



async function test_command(command, test_file): boolean {
  const data = Deno.readFileSync(test_file);
  const { answer, err, success, time_elapsed} = await run_command(command, data);

  // look for answer file
  if (!await exists(test_file + '-ans')) {
    console.info("Couldn't find file.");
    // Print output of program regardless
    return success;
  }

  const correct_answer = Deno.readFileSync(test_file + '-ans');

  const { description, answer: parsed_correct_answer } = parseAnswerFiles(decoder.decode(correct_answer));


  if (answer === parsed_correct_answer) {
    console.log(`\n${green("✔")} Test case \`${bold(path.basename(test_file))}\` passed in ${bold(time_elapsed.toString())} seconds`);
    return true;
  } else {
    console.log(`\n${red("✘")} Test case \`${bold(path.basename(test_file))}\` ${red("failed")} with input: \n${bold(decoder.decode(data))}`);
    console.log(`with output: ${bold(answer)}`);
    console.log(`when correct output was: ${bold(parsed_correct_answer)}`);
    
    if (err !== "") {
      console.log(`with stderr: ${red(err)}`);
    }
    if (description !== "") {
      console.log(`Test Description: ${bold(description)}`);
    }

    return false;
  }
}

async function run_command(command, data) {
  const start = performance.now();
  const cmd = Deno.run({
      cmd: command,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped"
  })
  if (!cmd.stdin) throw Error();

  await cmd.stdin.write(data);
  await cmd.stdin.close();

  const { code } = await cmd.status();
  const end = performance.now();
  const output = await cmd.output();
  const outStr = new TextDecoder().decode(output)
  const error = await cmd.stderrOutput();
  const errorStr = new TextDecoder().decode(error); 
  cmd.close();
  return { 
    answer: outStr.trim(), 
    err: errorStr, 
    success: code == 0,
    time_elapsed: (end - start) / 1000
  }
}

function parseAnswerFiles(filecontent) {
  const [metadata] = filecontent.match(/---[\d\D]*?---/) ?? [""];

  if (metadata === "") {
    return { description: "", answer: filecontent };
  }
  
  const parsed = metadata.replace(/---/g, "").trim();
  const answer = filecontent.replace(metadata, "").trim();
  return {
    description: parsed.match(/.*description:\s*([^\n\r]*)/)[1],
    answer,
  }
} 