import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.StringTokenizer;

public class Main {
  public static void main(String[] args) {

    InputReader in = new InputReader(System.in);

    /** Your Solution Here **/

    int n = in.nextInt();
    while (n-- > 0) {
      System.out.println(in.nextInt());
    }

  }

  // Definition of InputReader class
  static class InputReader {
    public BufferedReader reader;
    public StringTokenizer tokenizer;

    public InputReader(InputStream stream) {
      reader = new BufferedReader(new InputStreamReader(stream));
    }

    public String next() {
      while (tokenizer == null || !tokenizer.hasMoreElements()) {
        try {
          tokenizer = new StringTokenizer(reader.readLine());
        } catch (IOException e) {
          e.printStackTrace();
        }
      }
      return tokenizer.nextToken();
    }

    public int nextInt() {
      return Integer.parseInt(next());
    }

    public long nextLong() {
      return Long.parseLong(next());
    }

    public double nextDouble() {
      return Double.parseDouble(next());
    }

    public String nextLine() {
      String str = "";
      try {
        str = reader.readLine();
      } catch (IOException e) {
        e.printStackTrace();
      }
      return str;
    }
  }
}