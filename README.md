# APS Test Cases and Test Runner

Test Cases for Algorithmic Problem Solving. Also included are some [starter files] that come with optimizations for I/O and are gradescope compatible.  

## Using the Test Runner
In order to run the test runner you need to [download Deno](https://deno.land/#installation). Deno is a secure runtime for JavaScript and TypeScript built on Rust.

Use the command `./run_tests <source_file> <test_path>` to run the test runner, and get more help by using `./run_tests --help`.

The flags `-A` and `--unstable` allow for access to file system and other io tools as well as newer features (since this is a newer runtime).

The test runner compiles your code and runs it; before compiling, it first copies your code into a file called `.build/Main.ext` where `ext` is the extension of your program, and the `.build` folder is located in the same directory as the test runner. Because of this, you can name your file whatever you want; if you're using Java, you can name your file `Polish.java` and have a main class called `Main` in that file, and it'll work both with the runner and with Gradescope.

When creating test cases, you can optionally add description metadata to your answer file so you can see what exactly your test case is targeting so you can better debug your code.


### Examples

#### Standard Input
If your source file is at `/home/esilverm/aps/hw1/CarValue.java`, this repository is at `/home/esilverm/aps/aps-test-cases`, and the current directory is `/home/esilverm/aps`:

```
./run_tests hw1/CarValue.java
```

will compile the program and run it using standard input. You'll have the option to save your run as a test case. If you say yes, you'll get this prompt:

```
Where should this test case be stored?
```

*You can use tab completion here (not on Windows);* one tab completes, two tabs will suggest possible values.

#### Folder of Test Cases
You can compile and run the program using a folder of test cases by running

```
./run_tests hw1/CarValue.java aps-test-cases/hw1/car_value
```

This will run all test cases in the folder `car_value` and check them against the given answers in the folder.

#### Single test case
You can compile and run the program on a test case by using:

```
./run_tests hw1/CarValue.java aps-test-cases/hw1/car_value/example-1
```

This will run the test case `example-1` and check it against the contents of the file `example-1-ans` in the same directory.

## Contributing

If you have any test cases you would like to add, feel free to submit a PR! Also if you would like to add any optimization tips to the starter files mentioned above please feel free to do so!


[starter files]: Starters