import csv
import argparse
import os


def compare_storygraph_libraries(new_file, existing_file, output_file):
    """
    Compare two library CSV files and extract entries from the new file
    that don't exist in the existing file.

    Args:
        new_file: Path to the new CSV file (source of potential new entries)
        existing_file: Path to the existing CSV file (used to filter duplicates)
        output_file: Path to save the filtered CSV with unique entries
    """
    # Check if input files exist
    if not os.path.exists(new_file):
        print(f"Error: The file '{new_file}' does not exist.")
        return

    if not os.path.exists(existing_file):
        print(f"Error: The file '{existing_file}' does not exist.")
        return

    # First, let's determine the actual column names in each file
    with open(existing_file, 'r', encoding='utf-8') as f:
        existing_reader = csv.reader(f)
        existing_headers = next(existing_reader)

    with open(new_file, 'r', encoding='utf-8') as f:
        new_reader = csv.reader(f)
        new_headers = next(new_reader)

    # Find the title, author, and ISBN columns in the existing file
    title_col_existing = find_column_name(existing_headers, ['Title', 'title'])
    author_col_existing = find_column_name(existing_headers, ['Authors', 'Author', 'authors', 'author'])
    isbn_col_existing = find_column_name(existing_headers, ['ISBN/UID', 'ISBN', 'isbn', 'ISBN13', 'isbn13'])

    # Find the same columns in the new file
    title_col_new = find_column_name(new_headers, ['Title', 'title'])
    author_col_new = find_column_name(new_headers, ['Authors', 'Author', 'authors', 'author'])
    isbn_col_new = find_column_name(new_headers, ['ISBN/UID', 'ISBN', 'isbn', 'ISBN13', 'isbn13'])

    # Verify we have at least title columns
    if not title_col_existing or not title_col_new:
        print("Error: Could not find title column in one or both files.")
        print(f"Headers in existing file: {existing_headers}")
        print(f"Headers in new file: {new_headers}")
        return

    # Read existing library into memory
    existing_books = set()
    with open(existing_file, 'r', encoding='utf-8') as existing:
        reader = csv.DictReader(existing)
        for row in reader:
            # Create a unique identifier for each book based on title and author
            title = row.get(title_col_existing, '').strip().lower()

            # Only use author if the column exists
            author = ''
            if author_col_existing:
                author = row.get(author_col_existing, '')
                if author is not None:
                    author = author.strip().lower()
                else:
                    author = ''

            # Only use ISBN if the column exists
            isbn = ''
            if isbn_col_existing:
                isbn = row.get(isbn_col_existing, '')
                if isbn is not None:
                    isbn = isbn.strip().replace('-', '').replace('="', '').replace('"', '')
                else:
                    isbn = ''

            # Create a unique key - prioritize ISBN if available, otherwise use title+author
            if isbn:
                existing_books.add(isbn)

            # Always add title+author combination as fallback
            if author:
                existing_books.add(f"{title}|{author}")
            else:
                existing_books.add(title)

    # Process new file and find unique entries
    unique_entries = []
    with open(new_file, 'r', encoding='utf-8') as new:
        reader = csv.DictReader(new)
        fieldnames = reader.fieldnames

        for row in reader:
            title = row.get(title_col_new, '').strip().lower()

            author = ''
            if author_col_new:
                author = row.get(author_col_new, '').strip().lower()

            isbn = ''
            if isbn_col_new:
                isbn = row.get(isbn_col_new, '').strip().replace('-', '')
                isbn = isbn.replace('="', '').replace('"', '')

            # Check if this book exists in the existing library
            is_unique = True
            if isbn and isbn in existing_books:
                is_unique = False
            elif author and f"{title}|{author}" in existing_books:
                is_unique = False
            elif title in existing_books:  # Last resort check just by title
                is_unique = False

            if is_unique:
                unique_entries.append(row)

    # Write unique entries to output file
    with open(output_file, 'w', encoding='utf-8', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unique_entries)

    print(f"Comparison complete! Found {len(unique_entries)} books in '{new_file}' that aren't in '{existing_file}'")
    print(f"Unique books saved to '{output_file}'")


def find_column_name(headers, possible_names):
    """
    Find the actual column name in the headers that matches one of the possible names.
    Returns the first match or None if no match is found.
    """
    for name in possible_names:
        if name in headers:
            return name
    return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compare two library CSV files and extract unique entries")
    parser.add_argument("new_file", help="Path to the new CSV file (source of potential new entries)")
    parser.add_argument("existing_file", help="Path to the existing CSV file (used to filter duplicates)")
    parser.add_argument("output_file", help="Path to save the filtered CSV with unique entries")
    parser.add_argument("--debug", action="store_true", help="Print additional debug information")

    args = parser.parse_args()

    if args.debug:
        print("DEBUG MODE ENABLED")
        print(f"New file: {args.new_file}")
        print(f"Existing file: {args.existing_file}")
        print(f"Output file: {args.output_file}")

        # Print first few lines of each file to help diagnose issues
        print("\nFirst 3 lines of new file:")
        with open(args.new_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i < 3:
                    print(line.strip())
                else:
                    break

        print("\nFirst 3 lines of existing file:")
        with open(args.existing_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i < 3:
                    print(line.strip())
                else:
                    break

    compare_storygraph_libraries(args.new_file, args.existing_file, args.output_file)
