import csv
import os
import argparse
from math import ceil


def split_csv(input_file, output_prefix, chunk_size=50):
    """
    Split a large CSV file into smaller chunks.

    Args:
        input_file (str): Path to the input CSV file
        output_prefix (str): Prefix for output files (will be appended with _1.csv, _2.csv, etc.)
        chunk_size (int): Number of rows per output file (excluding header)
    """
    try:
        # Check if input file exists
        if not os.path.exists(input_file):
            print(f"Error: The file '{input_file}' does not exist.")
            return

        # Get file base name and directory
        base_dir = os.path.dirname(input_file)
        output_dir = base_dir if base_dir else "."

        # Read the input file
        with open(input_file, 'r', encoding='utf-8') as infile:
            # Read the header
            reader = csv.reader(infile)
            header = next(reader)

            # Count total rows to provide feedback
            infile.seek(0)
            total_rows = sum(1 for _ in infile) - 1  # Subtract header

            # Reset file pointer after counting
            infile.seek(0)
            reader = csv.reader(infile)
            next(reader)  # Skip header again

            # Calculate number of chunks
            num_chunks = ceil(total_rows / chunk_size)

            print(f"Splitting {input_file} ({total_rows} rows) into {num_chunks} files with {chunk_size} rows each.")

            # Create chunks
            for chunk_num in range(1, num_chunks + 1):
                # Create output file for this chunk
                output_file = f"{output_prefix}_{chunk_num}.csv"
                output_path = os.path.join(output_dir, output_file)

                with open(output_path, 'w', encoding='utf-8', newline='') as outfile:
                    writer = csv.writer(outfile)
                    writer.writerow(header)  # Write header

                    # Write rows for this chunk
                    rows_written = 0
                    for _ in range(chunk_size):
                        try:
                            row = next(reader)
                            writer.writerow(row)
                            rows_written += 1
                        except StopIteration:
                            break  # No more rows to read

                print(f"Created {output_file} with {rows_written} rows.")

        print("\nFile splitting complete!")
        print(f"\nYou can now import these smaller files into Goodreads one at a time:")
        for i in range(1, num_chunks + 1):
            print(f"  {output_prefix}_{i}.csv")

    except Exception as e:
        print(f"Error during file splitting: {str(e)}")


def split_by_status(input_file, output_prefix):
    """
    Split a CSV file into separate files based on the 'Exclusive Shelf' value.

    Args:
        input_file (str): Path to the input CSV file
        output_prefix (str): Prefix for output files (will be appended with _read.csv, _to-read.csv, etc.)
    """
    try:
        # Check if input file exists
        if not os.path.exists(input_file):
            print(f"Error: The file '{input_file}' does not exist.")
            return

        # Get file base name and directory
        base_dir = os.path.dirname(input_file)
        output_dir = base_dir if base_dir else "."

        # Initialize files dictionary
        output_files = {}
        writers = {}

        # Read the input file
        with open(input_file, 'r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            fieldnames = reader.fieldnames

            # Process each row
            status_counts = {}

            for row in reader:
                status = row.get('Exclusive Shelf', 'unknown')

                # Count books by status
                status_counts[status] = status_counts.get(status, 0) + 1

                # Create new output file if we haven't seen this status yet
                if status not in output_files:
                    output_file = f"{output_prefix}_{status}.csv"
                    output_path = os.path.join(output_dir, output_file)

                    output_files[status] = open(output_path, 'w', encoding='utf-8', newline='')
                    writers[status] = csv.DictWriter(output_files[status], fieldnames=fieldnames)
                    writers[status].writeheader()

                # Write row to appropriate file
                writers[status].writerow(row)

        # Close all output files
        for status, file in output_files.items():
            file.close()

        # Print summary
        print("\nFile splitting by status complete!")
        print("\nCreated the following files:")
        for status, count in status_counts.items():
            print(f"  {output_prefix}_{status}.csv: {count} books")

    except Exception as e:
        print(f"Error during file splitting: {str(e)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Split a large CSV file into smaller chunks")
    parser.add_argument("input_file", help="Path to the input CSV file")
    parser.add_argument("output_prefix", help="Prefix for output files")
    parser.add_argument("--chunk-size", type=int, default=50, help="Number of rows per output file (default: 50)")
    parser.add_argument("--by-status", action="store_true",
                        help="Split by 'Exclusive Shelf' value instead of fixed sizes")

    args = parser.parse_args()

    if args.by_status:
        split_by_status(args.input_file, args.output_prefix)
    else:
        split_csv(args.input_file, args.output_prefix, args.chunk_size)